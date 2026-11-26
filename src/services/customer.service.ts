// src/services/customer.service.ts
import { Customer } from "../db/schema";

// 閲覧者のロール等に応じた動的マスキング処理（メール・電話番号の機密保護）
export const maskCustomerData = (customer: Customer) => {
  const maskedEmail = customer.email.replace(
    /^(.)(.*)(@.*)$/,
    (_: string, first: string, middle: string, domain: string) => {
      if (middle.length === 0) {
        return `*${domain}`;
      }
      return `${first}${"*".repeat(middle.length)}${domain}`;
    }
  );

  const totalDigits = customer.phone.replace(/\D/g, "").length;
  let seen = 0;
  const maskedPhone = customer.phone.replace(/\d/g, (d) =>
    ++seen <= totalDigits - 4 ? "*" : d
  );

  return {
    ...customer,
    email: maskedEmail,
    phone: maskedPhone,
  };
};
