import { z } from "zod";

export const agreementType = z.enum(["NDA", "WHA"] as const);
export type Agreement = z.infer<typeof agreementType>;

const personFields = [
    "email",
    "role",
    "idType",
    "idNumber",
    "authority",
    "issueDate",
    "ndaUrl",
    "contractUrl",
] as const;

export type IPersonData = Record<(typeof personFields)[number], string>;
