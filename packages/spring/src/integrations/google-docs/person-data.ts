export type ContractType = "NDA" | "WHA";

type AddUrl<T extends string> = `${T}Url`;

export interface IPersonData {
    name: string;
    email: string;
    passport: string;
    authority: string;
    issueDate: string;
}

export type IPersonTableData = { name: string; email: string } & { [k in AddUrl<ContractType>]?: string };
