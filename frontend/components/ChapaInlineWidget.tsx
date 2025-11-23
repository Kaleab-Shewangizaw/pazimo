"use client";

import React, { useEffect } from "react";
import { useChapaPay } from "chapa-inline-hook";

type Props = {
  amount: number;
  publicKey: string;
  onSuccess: (data?: any) => void;
  onFail: (msg?: string) => void;
  mobile?: string;
  tx_ref?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  return_url?: string;
  callback_url?: string;
};

export default function ChapaInlineWidget({
  amount,
  publicKey,
  onSuccess,
  onFail,
  mobile,
  tx_ref,
  email,
  first_name,
  last_name,
  return_url,
  callback_url,
}: Props) {
  const { error, isPaymentSuccessful, isPaymentFailed, isPaymentClosed } =
    useChapaPay({
      amount,
      public_key: publicKey,
      tx_ref,
      email,
      first_name,
      last_name,
      return_url,
      callback_url,
      classIdName: "chapa-inline-form",
      styles: `
      .chapa-pay-button { 
        background-color: #0D47A1; 
        color: white;
      }
    `,
      showPaymentMethodsNames: false,
      ...(mobile ? { mobile } : {}),
    } as any);

  useEffect(() => {
    if (isPaymentSuccessful) onSuccess();
    if (isPaymentFailed) onFail("Payment failed");
    if (isPaymentClosed) onFail("Payment window closed");
    if (error) onFail(typeof error === "string" ? error : "Payment error");
  }, [isPaymentSuccessful, isPaymentFailed, isPaymentClosed, error]);

  return (
    <div>
      <div id="chapa-inline-form" />
    </div>
  );
}
