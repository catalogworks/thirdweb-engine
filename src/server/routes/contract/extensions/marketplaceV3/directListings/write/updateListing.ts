import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { queueTx } from "../../../../../../../db/transactions/queueTx";
import { getContract } from "../../../../../../../utils/cache/getContract";
import { directListingV3InputSchema } from "../../../../../../schemas/marketplaceV3/directListing";
import {
  marketplaceV3ContractParamSchema,
  requestQuerystringSchema,
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../../../../../schemas/sharedApiSchemas";
import { walletHeaderSchema } from "../../../../../../schemas/wallet";
import { getChainIdFromChain } from "../../../../../../utils/chain";

// INPUT
const requestSchema = marketplaceV3ContractParamSchema;
const requestBodySchema = Type.Intersect([
  Type.Object({
    listingId: Type.String({
      description: "The ID of the listing you want to update.",
    }),
  }),
  directListingV3InputSchema,
]);

requestBodySchema.examples = [
  {
    listingId: "0",
  },
];

// LOGIC
export async function directListingsUpdateListing(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof transactionWritesResponseSchema>;
    Body: Static<typeof requestBodySchema>;
    Querystring: Static<typeof requestQuerystringSchema>;
  }>({
    method: "POST",
    url: "/marketplace/:chain/:contractAddress/direct-listings/update-listing",
    schema: {
      summary: "Update direct listing",
      description: "Update a direct listing on this marketplace contract.",
      tags: ["Marketplace-DirectListings"],
      operationId: "updateListing",
      headers: walletHeaderSchema,
      params: requestSchema,
      body: requestBodySchema,
      querystring: requestQuerystringSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain, contractAddress } = request.params;
      const { simulateTx } = request.query;
      const {
        listingId,
        assetContractAddress,
        tokenId,
        pricePerToken,
        currencyContractAddress,
        isReservedListing,
        quantity,
        startTimestamp,
        endTimestamp,
      } = request.body;
      const {
        "x-backend-wallet-address": walletAddress,
        "x-account-address": accountAddress,
        "x-idempotency-key": idempotencyKey,
      } = request.headers as Static<typeof walletHeaderSchema>;

      const chainId = await getChainIdFromChain(chain);
      const contract = await getContract({
        chainId,
        contractAddress,
        walletAddress,
        accountAddress,
      });
      const tx = await contract.directListings.updateListing.prepare(
        listingId,
        {
          assetContractAddress,
          tokenId,
          pricePerToken,
          currencyContractAddress,
          isReservedListing,
          quantity,
          startTimestamp,
          endTimestamp,
        },
      );

      const queueId = await queueTx({
        tx,
        chainId,
        simulateTx,
        extension: "marketplace-v3-direct-listings",
        idempotencyKey,
      });

      reply.status(StatusCodes.OK).send({
        result: {
          queueId,
        },
      });
    },
  });
}
