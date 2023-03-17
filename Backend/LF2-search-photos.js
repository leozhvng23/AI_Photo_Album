// Reference Documentation:
// https://opensearch.org/docs/2.6/clients/javascript/index/
// https://docs.aws.amazon.com/lexv2/latest/dg/lambda.html

import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";

const REGION = "us-east-1";
const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: REGION,
    service: "es",
    getCredentials: () => {
      const credentialsProvider = defaultProvider();
      return credentialsProvider();
    },
  }),
  node: "https://search-photos-mxuc7wztqoqaofdypn2ua7t5le.us-east-1.es.amazonaws.com",
});

/**
 * Retrieves keywords from the input transcript and slots of a Lex event
 * @param {object} event - The Lex event object
 * @returns {Promise<string[]>} A promise that resolves to an array of keywords
 * @throws Error if input transcript is not found in the event
 */
async function getKeywordsFromLex(event) {
  const { inputTranscript, bot } = event;

  if (!inputTranscript) {
    throw new Error("Input transcript not found in the event");
  }

  const slots = event.interpretations[0].intent.slots;
  const keywords = Object.values(slots)
    .filter((slot) => slot && slot.value) // Filter out null slots and slots with no value property
    .map((slot) => slot.value.interpretedValue);
  console.log("Keywords:", keywords);
  return keywords;
}

/**
 * Searches for photos in an OpenSearch index based on the provided keywords
 * @param {string[]} keywords - An array of keywords to search for
 * @returns {Promise<object[]>} A promise that resolves to an array of photo objects that match the query
 */
async function searchPhotos(keywords) {
  keywords = cleanUpKeywords(keywords);
  console.log("Cleaned up keywords:", keywords);

  const body = {
    query: {
      bool: {
        should: keywords.map((keyword) => ({
          match: {
            labels: {
              query: keyword,
              boost: 1.0,
            },
          },
        })),
      },
    },
    size: 100,
    _source: ["objectKey", "bucket", "createdTimestamp", "labels"],
  };

  const results = await opensearchClient.search({
    index: "photos",
    body: body,
  });
  const hitsArray = results.body.hits.hits;
  if (hitsArray && hitsArray.length > 0) {
    console.log("Found results for the given query.", hitsArray);
    return hitsArray.map((hit) => hit._source);
  } else {
    console.log("No results found for the given query.");
    return [];
  }
}

/**
 * Cleans up the provided keywords by adding singular form of keywords ending with "s"
 * and lowercasing all keywords
 * @param {string[]} keywords - An array of keywords to clean up
 * @returns {string[]} An array of cleaned up keywords
 */
const cleanUpKeywords = (keywords) => {
  const singularKeywords = [];
  // lowercase all keywords
  keywords = keywords.map((keyword) => keyword.toLowerCase());
  // add singular form of keywords ending with "s"
  keywords.forEach((keyword) => {
    if (keyword.endsWith("s")) {
      singularKeywords.push(keyword.slice(0, -1));
    }
  });
  return keywords.concat(singularKeywords);
};

/**
 * Closes the current session by returning a Close dialog action and a message
 * @param {object} sessionState - The session state object
 * @param {object} message - The message to return to the user
 * @returns {object} An object containing the updated session state and the message to return to the user
 */
const close = async (sessionState, message) => {
  return {
    sessionState: {
      ...sessionState,
      dialogAction: {
        type: "Close",
      },
    },
    messages: [
      {
        contentType: "PlainText",
        content: message.content,
      },
    ],
  };
};

/**
 * Returns an ElicitSlot dialog action and a message to elicit a specific slot from the user
 * @param {object} sessionState - The session state object
 * @param {string} intentName - The name of the intent to elicit the slot for
 * @param {object} slots - The slots object for the intent
 * @param {string} slotToElicit - The name of the slot to elicit from the user
 * @param {object} message - The message to return to the user
 * @returns {object} An object containing the updated session state and the message to return to the user
 */
const elicitSlot = async (sessionState, intentName, slots, slotToElicit, message) => {
  return {
    sessionState: {
      ...sessionState,
      intent: {
        ...sessionState.intent,
        name: intentName,
        slots: slots,
      },
      dialogAction: {
        type: "ElicitSlot",
        slotToElicit: slotToElicit,
      },
    },
    messages: [
      {
        contentType: "PlainText",
        content: message.content,
      },
    ],
  };
};

const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  const currentIntent = event.interpretations[0].intent.name;
  console.log("Current intent:", currentIntent);

  if (currentIntent === "SearchIntent") {
    try {
      const keywords = await getKeywordsFromLex(event);
      if (keywords.length === 0) {
        return elicitSlot(event.sessionState, "SearchIntent", {}, "Keywords", {
          contentType: "PlainText",
          content: "Please provide some keywords to search for photos.",
        });
      }
      const searchResults = await searchPhotos(keywords);
      return close(event.sessionAttributes, "Fulfilled", {
        contentType: "PlainText",
        content: JSON.stringify(searchResults),
      });
    } catch (error) {
      console.error("Error processing the event:", error);
      return close(event.sessionState, {
        contentType: "PlainText",
        content: "Internal server error",
      });
    }
  }
  return close(event.sessionState, {
    contentType: "PlainText",
    content: "Internal server error",
  });
};

export { handler };
