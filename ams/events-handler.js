"use strict";

const logger = require("bunyan").createLogger({
  name: "EventsHandler",
  level: process.env.LOG_LEVEL
});

const AZURE_EVENTGRID_SUBSCRIPTION_VALIDATION_EVENT =
  "Microsoft.EventGrid.SubscriptionValidationEvent";
const AZURE_EVENTGRID_SUBSCRIPTION_DELETION_EVENT =
  "Microsoft.EventGrid.SubscriptionDeletedEvent";
const AZURE_MEDIA_JOB_STATE_CHANGE_EVENT = "Microsoft.Media.JobStateChange";

const AZURE_MEDIA_FINISHED_JOB_STATE = "Finished";
const AZURE_MEDIA_CANCELED_JOB_STATE = "Canceled";
const AZURE_MEDIA_ERROR_JOB_STATE = "Error";

function AzureEvents() {}

AzureEvents.isAzureEvent = function(body) {
  return body && body.eventType && body.eventType.startsWith("Microsoft");
};

AzureEvents.isSubscriptionValidationEvent = function(body) {
  return (
    body &&
    body.eventType &&
    body.eventType === AZURE_EVENTGRID_SUBSCRIPTION_VALIDATION_EVENT
  );
};

AzureEvents.isSubscriptionDeletionEvent = function(body) {
  return (
    body &&
    body.eventType &&
    body.eventType === AZURE_EVENTGRID_SUBSCRIPTION_DELETION_EVENT
  );
};

AzureEvents.isJobStateChangedEvent = function(body) {
  return (
    body &&
    body.eventType &&
    body.eventType === AZURE_MEDIA_JOB_STATE_CHANGE_EVENT
  );
};

AzureEvents.isJobFinishedEvent = function(body) {
  return (
    AzureEvents.isJobStateChangedEvent(body) &&
    body.data.state === AZURE_MEDIA_FINISHED_JOB_STATE
  );
};

AzureEvents.isJobCanceledEvent = function(body) {
  return (
    AzureEvents.isJobStateChangedEvent(body) &&
    body.data.state === AZURE_MEDIA_CANCELED_JOB_STATE
  );
};

AzureEvents.isJobErrorEvent = function(body) {
  return (
    AzureEvents.isJobStateChangedEvent(body) &&
    body.data.state === AZURE_MEDIA_ERROR_JOB_STATE
  );
};

// This is an Express middleware handling Azure events
function AzureEventsHandler(req, res, next) {
  if (!AzureEvents.isAzureEvent(req.body)) return next();

  logger.info({ label: "Azure Event Received" }, req.body);

  if (AzureEvents.isSubscriptionValidationEvent(req.body)) {
    res.status(200).send({
      validationResponse: body.data.validationCode
    });
  } else {
    res.status(204).end();
  }
}

module.exports = { AzureEvents, AzureEventsHandler };
