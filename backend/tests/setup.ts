import { randomBytes } from "node:crypto";
import { loadTestEnvironment } from "../scripts/testEnvironment.js";

loadTestEnvironment();
process.env.JWT_SECRET ??= randomBytes(32).toString("base64url");
