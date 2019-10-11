"use strict";

const { EventGridManagementClient } = require("@azure/arm-eventgrid");

const logger = require("bunyan").createLogger({
  name: "EventManager",
  level: process.env.LOG_LEVEL
});

const AZURE_EVENT_SUBSCRIPTION_ENDPOINT_TYPE = "WebHook";
const AZURE_MEDIA_JOB_STATE_CHANGE_EVENT = "Microsoft.Media.JobStateChange";

const SUBSCRIPTION_NAME = "box-skill-event-subscription";

const SUBSCRIPTION_INFO = {
  destination: {
    endpointType: AZURE_EVENT_SUBSCRIPTION_ENDPOINT_TYPE,
    endpointUrl: process.env.ENDPOINT,
    endpointBaseUrl: process.env.ENDPOINT
  },
  filter: {
    includedEventTypes: [AZURE_MEDIA_JOB_STATE_CHANGE_EVENT]
  }
};

// EventSubscription
function EventSubscription(credentials, subscriptionScope) {
  this._client = new EventGridManagementClient(
    credentials,
    process.env.SUBSCRIPTION_ID
  );
  logger.debug(_client);

  this._subscriptionScope = subscriptionScope;
  logger.debug(_subscriptionScope);
}

EventSubscription.prototype.createOrUpdate = async function() {
  try {
    await this._client.eventSubscriptions.get(
      this._subscriptionScope,
      SUBSCRIPTION_NAME
    );
    logger.info("Event subscription already exists");
  } catch (err) {
    logger.info("Create a new event subscription");
    await this._client.eventSubscriptions.createOrUpdate(
      this._subscriptionScope,
      SUBSCRIPTION_NAME,
      SUBSCRIPTION_INFO
    );
    logger.info("Event subscription created");
  }
};

module.exports = EventSubscription;
