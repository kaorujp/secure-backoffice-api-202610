// src/services/customer.service.ts
import { Customer } from "../db/schema";

// 閲覧者のロール等に応じた動的マスキング処理（メール・電話番号の機密保護）
export const maskCustomerData = (customer: Customer) => {
const maskedEmail = customer.email.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => {
    return `${first}${"*".repeat(middle.length)}${domain}`;
  });

  const maskedPhone = customer.phone.replace(/\d(?=\d{4})/g, "*");

  return {
    ...customer,
    email: maskedEmail,
    phone: maskedPhone,
  };
};
