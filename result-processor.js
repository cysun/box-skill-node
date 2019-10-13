"use strict";

const url = require("url");
const find = require("lodash/find");
const map = require("lodash/map");
const slice = require("lodash/slice");
const msRestNodeAuth = require("@azure/ms-rest-nodeauth");
const { AzureMediaServices } = require("@azure/arm-mediaservices");
const azureStorage = require("azure-storage");
const { SkillsWriter } = require("./skills-kit-2.0");

const logger = require("bunyan").createLogger({
  name: "ResultProcessor",
  level: process.env.LOG_LEVEL
});

const MOST_NUMBER_OF_RELEVANT_FACES = 20;
const MOST_NUMBER_OF_RELEVANT_KEYWORDS = 25;
const CONFIDENCE_CUTOFF = 0.6;

// ResultProcessor
function ResultProcessor(job, fileContext) {
  this._job = job;
  this._fileContext = fileContext;
  this._skillsWriter = new SkillsWriter(fileContext);
}

ResultProcessor.getBlobsSegmented = async function(
  sharedBlobService,
  containerName
) {
  return new Promise((resolve, reject) =>
    sharedBlobService.listBlobsSegmented(containerName, null, (err, result) => {
      if (err) {
        logger.error({ label: "Failed to get blobs" }, err);
        reject(err);
      } else {
        resolve(result);
      }
    })
  );
};

ResultProcessor.getInsightsJson = async function(
  sharedBlobService,
  containerName,
  insightsName
) {
  return new Promise((resolve, reject) =>
    sharedBlobService.getBlobToText(
      containerName,
      insightsName,
      (error, result) => {
        if (error) {
          logger.error({ label: "Failed to get insights.jon" }, err);
          reject(error);
        } else {
          resolve(result);
        }
      }
    )
  );
};

ResultProcessor.convertTimeToSeconds = function(timestring) {
  if (!timestring) return null;
  const tt = timestring.split(":");
  return tt[0] * 3600 + tt[1] * 60 + tt[2] * 1;
};

ResultProcessor.mapKeywordData = function(keywords) {
  return map(keywords, keyword => ({
    text: keyword.text,
    appears: map(keyword.instances, instance => ({
      start: ResultProcessor.convertTimeToSeconds(instance.start),
      end: ResultProcessor.convertTimeToSeconds(instance.end)
    }))
  }));
};

// init() should be called before any other methods
ResultProcessor.prototype.init = async function() {
  this._credentials = await msRestNodeAuth.loginWithServicePrincipalSecret(
    process.env.AAD_CLIENT_ID,
    process.env.AAD_SECRET,
    process.env.AAD_TENANT_ID
  );

  this._client = new AzureMediaServices(
    this._credentials,
    process.env.SUBSCRIPTION_ID,
    { noRetryPolicy: true }
  );

  const date = new Date();
  date.setHours(date.getHours() + 1);
  const assetContainerSas = await this._client.assets.listContainerSas(
    process.env.RESOURCE_GROUP,
    process.env.ACCOUNT_NAME,
    this._job.asset,
    { expiryTime: date, permissions: "Read" }
  );

  this._containerSasUrl = assetContainerSas.assetContainerSasUrls[0] || null;
  this._sasUri = url.parse(this._containerSasUrl);
  this._containerName = this._sasUri.pathname.replace(/^\/+/g, "");
};

ResultProcessor.prototype.downloadVideoInsights = async function() {
  const sharedBlobService = azureStorage.createBlobServiceWithSas(
    this._sasUri.host,
    this._sasUri.search
  );

  const blobs = await ResultProcessor.getBlobsSegmented(
    sharedBlobService,
    this._containerName
  );
  const insightsBlob = find(
    blobs.entries,
    o => o.blobType === "BlockBlob" && o.name === "insights.json"
  );
  const insightsJSON = await ResultProcessor.getInsightsJson(
    sharedBlobService,
    this._containerName,
    insightsBlob.name
  );

  this._insights = JSON.parse(insightsJSON);
  logger.debug({ label: "Insights Statistics" }, this._insights.statistics);
};

ResultProcessor.prototype.getAzureThumbnailURL = function(thumbnailId) {
  const { host, pathname, search } = this._sasUri;
  const thumbnailName = `FaceThumbnail_${thumbnailId}.jpg`;
  return `https://${host}${pathname}/${thumbnailName}${search}`;
};

ResultProcessor.prototype.getFacesCard = async function(faces, duration) {
  const facesData = [];
  let unknownFacesCounter = 1;
  const relevantFaces = slice(faces, 0, MOST_NUMBER_OF_RELEVANT_FACES);
  for (const face of relevantFaces) {
    facesData.push({
      type: "image",
      text: face.name || `Unknown #${unknownFacesCounter}`,
      image_url: this.getAzureThumbnailURL(face.thumbnailId),
      appears: map(face.instances, instance => ({
        start: ResultProcessor.convertTimeToSeconds(instance.start),
        end: ResultProcessor.convertTimeToSeconds(instance.end)
      }))
    });
    unknownFacesCounter += 1;
  }
  return this._skillsWriter.createFacesCard(facesData, duration);
};

ResultProcessor.prototype.getTopicCards = function(ocr, keywords, duration) {
  const relevantOcr = slice(
    ocr
      // this is to prevent from reading gibberish characters in video as foreign words
      .filter(
        ocrWord =>
          ocrWord.confidence > CONFIDENCE_CUTOFF &&
          ocrWord.language === process.env.LANGUAGE
      ),
    0,
    MOST_NUMBER_OF_RELEVANT_KEYWORDS
  );

  const relevantKeywords = slice(
    keywords.filter(
      keyword =>
        relevantOcr.indexOf(keyword) < 0 &&
        keyword.confidence > CONFIDENCE_CUTOFF &&
        keyword.language === process.env.LANGUAGE
    ),
    0,
    MOST_NUMBER_OF_RELEVANT_KEYWORDS
  );

  const ocrData = ResultProcessor.mapKeywordData(relevantOcr);
  const keywordData = ResultProcessor.mapKeywordData(relevantKeywords);
  return [
    this._skillsWriter.createTopicsCard(ocrData, duration, "Text"),
    this._skillsWriter.createTopicsCard(keywordData, duration)
  ];
};

ResultProcessor.prototype.getTranscriptsCard = function(transcript, duration) {
  const transcriptData = map(transcript, line => ({
    text: line.text,
    appears: map(line.instances, instance => ({
      start: ResultProcessor.convertTimeToSeconds(instance.start),
      end: ResultProcessor.convertTimeToSeconds(instance.end)
    }))
  }));
  return this._skillsWriter.createTranscriptsCard(transcriptData, duration);
};

ResultProcessor.prototype.getSkillMetadataCards = async function() {
  const {
    faces = [],
    ocr = [],
    keywords = [],
    transcript = [],
    duration: timeTaken = "00:00:00"
  } = this._insights;
  const duration = ResultProcessor.convertTimeToSeconds(timeTaken);
  const facesCard = [await this.getFacesCard(faces, duration)];
  const cards = [
    ...facesCard,
    ...this.getTopicCards(ocr, keywords, duration),
    this.getTranscriptsCard(transcript, duration)
  ];
  return { cards, duration };
};

ResultProcessor.prototype.processResult = async function() {
  await this.downloadVideoInsights();
  const { cards, duration } = await this.getSkillMetadataCards();

  await this.cleanUp();

  const callback = (status, error) => {
    if (error) {
      logger.error({ label: "Failed to save metadata cards" }, error);
      this._skillsWriter.saveErrorCard(SkillsErrorEnum.INVOCATIONS_ERROR);
    } else {
      logger.info("Skill Success!");
    }
  };
  this._skillsWriter.saveDataCards(cards, callback, null, {
    unit: "seconds",
    value: parseInt(duration, 10)
  });
};

ResultProcessor.prototype.cleanUp = async function() {
  await this._client.jobs.deleteMethod(
    process.env.RESOURCE_GROUP,
    process.env.ACCOUNT_NAME,
    this._job.transform,
    this._job.name
  );
  await this._client.assets.deleteMethod(
    process.env.RESOURCE_GROUP,
    process.env.ACCOUNT_NAME,
    this._job.asset
  );
};

module.exports = ResultProcessor;
