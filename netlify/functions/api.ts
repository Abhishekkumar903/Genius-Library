import serverless from "serverless-http";
import { createExpressApp } from "../../src/serverApp.js";

const app = createExpressApp();

export const handler = serverless(app);
