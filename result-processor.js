"use strict";

const url = require("url");
const find = require("lodash/find");
const msRestNodeAuth = require("@azure/ms-rest-nodeauth");
const { AzureMediaServices } = require("@azure/arm-mediaservices");
const azureStorage = require("azure-storage");

const logger = require("bunyan").createLogger({
  name: "ResultProcessor",
  level: process.env.LOG_LEVEL
});

// ResultProcessor
function ResultProcessor(job, fileContext) {
  this._job = job;
  this._fileContext = fileContext;
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
};

ResultProcessor.prototype.downloadVideoInsights = async function() {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  const assetContainerSas = await this._client.assets.listContainerSas(
    process.env.RESOURCE_GROUP,
    process.env.ACCOUNT_NAME,
    this._job.asset,
    { expiryTime: date, permissions: "Read" }
  );

  const containerSasUrl = assetContainerSas.assetContainerSasUrls[0] || null;
  const sasUri = url.parse(containerSasUrl);
  const sharedBlobService = azureStorage.createBlobServiceWithSas(
    sasUri.host,
    sasUri.search
  );
  const containerName = sasUri.pathname.replace(/^\/+/g, "");
  const blobs = await ResultProcessor.getBlobsSegmented(
    sharedBlobService,
    containerName
  );

  const insightsBlob = find(
    blobs.entries,
    o => o.blobType === "BlockBlob" && o.name === "insights.json"
  );
  const insightsJSON = await ResultProcessor.getInsightsJson(
    sharedBlobService,
    containerName,
    insightsBlob.name
  );
  const insights = JSON.parse(insightsJSON);

  logger.debug({ label: "Insights Statistics" }, insights.statistics);

  return { containerSasUrl, insights };
};

ResultProcessor.prototype.processResult = async function() {
  await this.downloadVideoInsights();
  // getSkillMetadataCards()
  // cleanup()
  // saveDataCards()
};

module.exports = ResultProcessor;
