import { z } from "zod";

export const agreementType = z.enum(["NDA", "WHA", "SDA (fixed per sprint)"] as const);
export type Agreement = z.infer<typeof agreementType>;

const personFields = [
    "Position",
    "Description",
    "Status",
    "Payment Conditions",
    "Id Type",
    "Id Number",
    "Issue Authority",
    "Issue Date",
    "Email",
    "NDA",
    "Contract",
] as const;

export type IPersonData = Record<(typeof personFields)[number], string>;

// We need it to be a type
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ITemplateData = {
    Url: string;
};
