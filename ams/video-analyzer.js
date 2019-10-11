"use strict";

const msRestNodeAuth = require("@azure/ms-rest-nodeauth");
const { AzureMediaServices, Transform } = require("@azure/arm-mediaservices");
const uuidv4 = require("uuid/v4");

const logger = require("bunyan").createLogger({
  name: "VideoAnalyzer",
  level: process.env.LOG_LEVEL
});

//const AUDIO_ANALYZER_PRESET_ODATATYPE = '#Microsoft.Media.AudioAnalyzerPreset';
const VIDEO_ANALYZER_PRESET_ODATATYPE = "#Microsoft.Media.VideoAnalyzerPreset";
const MS_MEDIA_JOB_INPUT_HTTP = "#Microsoft.Media.JobInputHttp";
const MS_MEDIA_JOB_OUTPUT_ASSET = "#Microsoft.Media.JobOutputAsset";

const JOB_PREFIX = "box-skill-job";
const ASSET_PREFIX = "box-skill-output";

// VideoAnalyzer
function VideoAnalyzer() {
  this._jobId = uuidv4();
  this._jobName = `${JOB_PREFIX}-${this._jobId}`;
  this._outputAssetName = `${ASSET_PREFIX}-${this._jobId}`;
  this._transformName = `VideoAnalyzerTransform_${process.env.LANGUAGE}`;
  this._analyzerPreset = {
    odatatype: VIDEO_ANALYZER_PRESET_ODATATYPE,
    audioLanguage: process.env.LANGUAGE
  };
}

// init() should be called before any other methods
VideoAnalyzer.prototype.init = async function() {
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

  // this._service = await this._client.mediaservices.get(
  //   process.env.RESOURCE_GROUP,
  //   process.env.ACCOUNT_NAME
  // );

  this._transform = await this._client.transforms.get(
    process.env.RESOURCE_GROUP,
    process.env.ACCOUNT_NAME,
    this._transformName
  );
  if (this._transform.error) {
    this._transform = await this._client.transforms.createOrUpdate(
      process.env.RESOURCE_GROUP,
      process.env.ACCOUNT_NAME,
      this._transformName,
      {
        name: this._transformName,
        location: process.env.REGION,
        outputs: [{ preset: this._analyzerPreset }]
      }
    );
  }
};

VideoAnalyzer.prototype.createJob = async function() {
  let outputAsset = await this._client.assets.createOrUpdate(
    process.env.RESOURCE_GROUP,
    process.env.ACCOUNT_NAME,
    this._outputAssetName,
    {}
  );
  let jobInput = {
    odatatype: MS_MEDIA_JOB_INPUT_HTTP,
    files: ["https://sun.calstatela.edu/~cysun/news1.mp4"]
  };
  let jobOutputs = [
    {
      odatatype: MS_MEDIA_JOB_OUTPUT_ASSET,
      assetName: outputAsset.name
    }
  ];
  this._job = await this._client.jobs.create(
    process.env.RESOURCE_GROUP,
    process.env.ACCOUNT_NAME,
    this._transformName,
    this._jobName,
    {
      input: jobInput,
      outputs: jobOutputs
    }
  );
};

module.exports = VideoAnalyzer;
