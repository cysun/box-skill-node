"use strict";

const startsWith = require("lodash/startsWith");

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

// This method should be called before any other isXXXEvent() to ensure that
// the request contains Azure event(s) to begin with.
AzureEvents.isAzureEvent = function(events) {
  return events && events[0] && startsWith(events[0].eventType, "Microsoft");
};

AzureEvents.isSubscriptionValidationEvent = function(event) {
  return event.eventType === AZURE_EVENTGRID_SUBSCRIPTION_VALIDATION_EVENT;
};

AzureEvents.isSubscriptionDeletionEvent = function(event) {
  return event.eventType === AZURE_EVENTGRID_SUBSCRIPTION_DELETION_EVENT;
};

AzureEvents.isJobStateChangedEvent = function(event) {
  return event.eventType === AZURE_MEDIA_JOB_STATE_CHANGE_EVENT;
};

AzureEvents.isJobFinishedEvent = function(event) {
  return (
    AzureEvents.isJobStateChangedEvent(event) &&
    event.data.state === AZURE_MEDIA_FINISHED_JOB_STATE
  );
};

AzureEvents.isJobCanceledEvent = function(event) {
  return (
    AzureEvents.isJobStateChangedEvent(event) &&
    event.data.state === AZURE_MEDIA_CANCELED_JOB_STATE
  );
};

AzureEvents.isJobErrorEvent = function(event) {
  return (
    AzureEvents.isJobStateChangedEvent(event) &&
    event.data.state === AZURE_MEDIA_ERROR_JOB_STATE
  );
};

// This is an Express middleware handling Azure events
function AzureEventsHandler(req, res, next) {
  if (!AzureEvents.isAzureEvent(req.body)) return next();

  logger.info({
    label: "Azure event received",
    eventType: req.body[0].eventType
  });

  if (AzureEvents.isSubscriptionValidationEvent(req.body[0])) {
    res.status(200).send({
      validationResponse: req.body[0].data.validationCode
    });
  } else {
    res.status(204).end();
  }
}

function BoxEvents() {}

BoxEvents.isSkillInvocationEvent = function(event) {
  return event && event.type && event.type === "skill_invocatio";
};

module.exports = { AzureEvents, AzureEventsHandler, BoxEvents };
