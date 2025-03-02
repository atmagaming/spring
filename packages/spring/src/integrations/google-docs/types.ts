import { z } from "zod";

export const agreementType = z.enum(["NDA", "WHA"] as const);
export type Agreement = z.infer<typeof agreementType>;

type AddUrl<T extends string> = `${T}Url`;

export interface IPersonData {
    role: string;
    identification: string;
    name: string;
    email: string;
    passport: string;
    authority: string;
    issueDate: string;
}

export type IPersonTableData = { name: string; email: string } & { [k in AddUrl<Agreement>]?: string };
