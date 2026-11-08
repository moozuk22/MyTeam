# IRISPay by Link/QR API — Sanitized Reference

Source: `PayByLink_QR_v.3.5.7.pdf`, version 3.5.7, dated 13 October 2026.

This is a sanitized text transcription, not an unmodified official document. The original PDF is not included. API paths, methods, parameter names, example JSON structures, statuses, flows, and technical explanations are retained below in their source layout. Embedded screenshots are omitted to avoid retaining credentials or personal data; the accompanying textual testing steps remain.

Every value ending in `_PLACEHOLDER` is a nonfunctional label, never a working credential or account. Merchant/location keys, bank hashes, usernames, all literal IBANs, and the support email have been replaced. JSON `"string"` values are generic source examples, not credentials. Do not substitute production credentials or initiate real payments in automated tests; mock provider interactions. Report discrepancies with the implementation rather than silently changing payment behavior.

## API Reference Transcription

```text
IRISPay by Link/QR Integration
Guidelines
Version: 3.5.7
Last Updated: 13.10.2026


Table of Contents
  1. Introduction
  2. The Process
        1. Get bank hashes
        2. Api based payment link generation
        3. Payment link to QR code exchange
        4. Payment Status Check
        5. Payment Status Check For Reusable Payments
        6. Refund the payment
        7. Deactivate a payment link
  3. Testing
  4. Test to Production migration
  5. Support


Introduction
Welcome to the IRISPay by Link/QR API Integration Guide.


What is it? A technology solution that enables merchants to accept payments
directly from customers’ bank accounts through their online stores or mobile
applications.
It also allows any instant messaging communication (e.g., SMS, Viber,
Messenger, WhatsApp) or digital document (such as an e-invoice, email or
contract) to be transformed into a point of payment or point of sale (POS).
The system generates secure payment links/QR that can be shared via the
merchant’s preferred communication channel. In some cases, the user is
redirected to a separate browser tab to complete the payment.
What is needed to have it? The merchant should be registered with the IRIS
Merchant portal to obtain the publicHash (key) and bank account/s, which
will acquire the payments processed by the terminal.
TESTING: For the test key, please refer to the Testing section.


The Process
1. GET banks hashes

Get all banks' hashes to create a payment link/QR code with certain bank/s.
Use only banks where pisAvailable is set to true .
Endpoint

  GET /backend/payment/banks/{key}



 Parameter Type                             Description
                       You can obtain this key from your Location within the
 key          string
                       Merchant Portal.

Request Example


  curl -X GET
 "https://dev.paybyclick.irispay.bg/backend/payment/banks/<MERCHANT_LOCATION_KEY_PLACEHOLDER>" -H       "accept: */*"


Response Example

   [
       {
           "bankHash": "<BANK_HASH_PLACEHOLDER>",
           "name": "Gringotts",
           "fullName": "Gringotts Bank",
           "bic": "example",
           "services": "Account Information Services and Payment
   Initiation Services",
           "country": "bulgaria",
           "aisAvailable": true,
           "pisAvailable": true
       },
       ...
   ]




2. API-based payment link generation

To generate a payment link, the merchant must send the following request:
Endpoint

  POST /backend/payment/external/{key}



 Parameter Type                               Description
                         You can obtain this key from your Location within the
 key            string
                         Merchant Portal.

Request Example


  {
      "bankHashes": ["string"],
      "currency": "EUR",
      "description": "string",
      "hookUrl": "string",
      "lang": "string",
      "name": "string",
      "orderId": "string",
      "redirectUrl": "string",
      "sum": 1.49,
      "repayable": false,
      "requestShortLink": false
  }




   Parameter         Requirements                Description

                                    An array of strings/hashes of individual
                                    banks that can be optionally passed in.
bankHashes           optional       In case there is no need for a
                                    customized selection/set of banks, the
                                    parameter may not be passed in.

currency             mandatory      Currency of the payment (EUR or RON)
                                    Description of the payment will be
description          mandatory      present only in the IRIS Solutions
                                    systems, up to 240 symbols


                               URL which Iris will call when there is a
                               change in the payment status - https://
                               required. When there is a change in
                               the payment status, the PaybyClick
                               backend will refer to the specified
hookUrl            mandatory
                               hookUrl with:
                               https://exampleurl.com/merchant?
                               status=FAILED
                               https://exampleurl.com/merchant?
                               status=CONFIRMED
                               Shortened description of the payment
                               will be present in the fund transfer
name               optional
                               form of the bank in the description
                               placeholder, up to 34 symbols

                               URL, to which the end-user will be
redirectUrl        mandatory   redirectedwhen the payment is
                               confirmed/rejected - https:// required

                               Additional text to keep track of the
orderId            optional
                               orderId from the merchant systems

sum                mandatory   payment amount
                               The requested language can be
lang               optional    chosen between ('bg', 'ro', 'el', 'en', ‘hr’
                               ), and if empty 'bg' by default
                               Set to true if the payment link must be
repayable          optional
                               reusable
                               Set to true if you want to receive a
requestShortLink optional
                               short payment link

Response Example


   {
       "accountId": "string",
       "paymentHash": "string",
       "paymentLink": "string",
       "shortPaymentLink": "string"
   }




       Parameter                           Description
                     ID of the merchant account registered in the IRIS
 accountId
                     system

 paymentHash         Unique hash of the payment
 paymentLink         Link/URL of the payment

 shortPaymentLink Short Link/URL of the payment


3. Payment link to QR code exchange

You can generate a QR code and receive it as an image. This feature is
available as an addition to the standard payment link generation. Direct QR
code-only generation is not supported.
Endpoint

  GET /backend/payment/qr/{hash}



 Parameter Type                            Description
                      The payment hash ("paymentHash") received in the
 hash          string response to the payment link generation POST API
                      request.

Response Returns a byte array representing the QR code image, with the
Content-Type header set to image/jpeg .


4. Payment Status Check

You can check the status of each payment link or QR code via an API call
where repayable is false. This feature is available in addition to the webhook
call, which notifies you automatically when the payment status changes.
Use Payment Status Check For Reusable Payments when you are creating
payments with repayable=true!
Endpoint

  GET /backend/payment/status/{hash}



 Parameter Type                              Description

                     The payment hash ("paymentHash") received in the
 hash         string response to the payment link generation POST API
                     request.

Response Example

   {
       "currency": "EUR",
       "date": "2025-10-08T13:02:20.901Z",
       "description": "string",
       "orderId": "string",
       "payerBank": "string",
       "payerIban": "string",
       "payerName": "string",
       "receiverIban": "string",
       "status": "string",
       "sum": 0
   }




  Parameter                              Description
 currency         Currency of the payment (EUR or RON)


 date           Payment date
 description    Description of the payment

 orderId        OrderId from the merchant systems (if specified)
 payerBank      Payer's bank

 payerIban      Payer's IBAN
 payerName      Payer's name

 receiverIban   Merchant’s(receiver) IBAN

 status         Status of the payment: WAITING, FAILED or CONFIRMED
 sum            Amount of the payment

5. Payment Status Check For Reusable Payments

Use this endpoint when you want to check the status for payments where
repayable is set to true.
Endpoint

  GET /backend/payment/status/repayable/{hash}



 Parameter      Type                         Description

                         The payment hash ("paymentHash") received in
 hash           string   the response to the payment link generation POST
                         API request.

 X-Location-
                header The key of your Location.
 Key

Response Example


  {
       "date": "2026-09-16T07:57:19.000+00:00",
       "status": "status",
       "description": "string",
       "sum": 0,
       "currency": "EUR",
       "receiverIban": "string",
       "orderId": "string",
       "paymentHash": "string",
       "attempts": [
           {
               "date": "2026-09-16T08:22:53.000+00:00",
               "status": "string",
               "payerIban": "string",
               "payerBank": "string",
               "payerName": "string",
               "attemptPaymentHash": "string"
           }
       ]
  }




 Parameter                                   Description

date                 Payment date
                     Status of the payment: WAITING, FAILED or CONFIRMED.
status
                     See bellow how to read the payment status.

description          Description of the payment
sum                  Amount of the payment

currency             Currency of the payment (EUR or RON)
receiverIban         Merchant’s(receiver) IBAN

orderId              OrderId from the merchant systems (if specified)

paymentHash Unique hash identifying the payment


                 List of payment attempts made for this payment (see the
 attempts
                 table below)

Attempt object (attempts[]):

        Parameter                             Description

 date                     Payment date
                          Status of the payment attempt: WAITING, FAILED
 status
                          or CONFIRMED

                          Payer’s IBAN (null if the attempt did not reach the
 payerIban
                          point of identifying the payer)

                          Payer’s bank (null if the attempt did not reach the
 payerBank
                          point of identifying the payer)

                          Payer’s name (null if the attempt did not reach the
 payerName
                          point of identifying the payer)
 attemptPaymentHash Unique hash identifying the payment attempt

How to read the payment status of a repayable payment:

    Payment
                                           Description
     Status

 CONFIRMED          at least one attempt has status CONFIRMED
                    at least one attempt has status WAITING and none have
 WAITING
                    status CONFIRMED
                    at least one attempt has status FAILED and none have
 FAILED
                    status WAITING or CONFIRMED


6. Refund the payment


There is an option to have the payment partially or fully refunded.
Endpoint

  POST /backend/payment/external/refund/{key}



 Parameter Type                              Description
                        You can obtain this key from your Location within the
 key           string
                        Merchant Portal.

Request Example

   {
       "paymentHash": "string",
       "psuId": "string",
       "refundType": "FULL",
       "remittanceDescription": "string",
       "sum": 0,
       "webhookUrl": "string"
   }




         Parameter          Requirements               Description
                                            The payment hash
                                            ("paymentHash") received in the
 paymentHash                mandatory
                                            response to the payment link
                                            generation POST API request.

                                            Internet banking username,
 psuId                      optional        needed only if the payer bank
                                            requires
                                            FULL - full refund of payment;
 refundType                 mandatory
                                            PARTIAL - partial refund

 remittanceDescription mandatory            description of the refund payment


 sum                     mandatory        amount of the refund
                                          URL which Iris will call when there
                                          is a change in the payment status
                                          - https:// required. When there is
                                          a change in the payment status,
                                          the PaybyClick backend will refer
 webhookUrl              mandatory
                                          to the specified hookUrl with:
                                          https://exampleurl.com/merchant?
                                          status=FAILED
                                          https://exampleurl.com/merchant?
                                          status=CONFIRMED

Response Example

   {
       "bankScaType": "string",
       "url": "string"
   }




  Parameter                             Description
             Payment authorization method: REDIRECT_URL - redirect
             to address (bank environment); CODE_REDIRECT_URL -
 bankScaType redirect to address + OTP (One Time Password) code via
             software token or SMS; PUSH - decoupled solution with
             sending a message to a software token/application;

                 Authorisation URL for the payment. The URL will redirect
 url             the user/payer to the bank environment to confirm the
                 payment.


7. Deactivate a payment link


Call this endpoint to deactivate a payment link. After deactivating a payment
link it cannot be activated again.
Endpoint

  PUT /backend/payment/inactive/{key}



 Parameter Type                              Description

                        You can obtain this key from your Location within the
 key           string
                        Merchant Portal.

Request Example

   {
        "paymentHash": "string"
   }




  Parameter       Requirements                     Description

                                   The payment hash ("paymentHash")
 paymentHash mandatory             received in the response to the payment
                                   link generation POST API request.


Testing
To successfully test the functionalities, please use the following test key and
test account provided by the test bank:
Merchant key: <MERCHANT_LOCATION_KEY_PLACEHOLDER>

toIban: <IBAN_PLACEHOLDER>
User:
IBAN: <IBAN_PLACEHOLDER> (IRIS Solutions Test Bank)


username: <TEST_USERNAME_PLACEHOLDER> (IRIS Solutions Test Bank)
  1. Choose IRIS Solution Test Bank from the list



  2. Provide the user and IBAN for the test Bank




  3. Payment confirmation Upon successful payment confirmation, a
     message will appear, and after a few seconds, you will be redirected to
     the specified redirectUrl.


Test to Production migration
To switch to the production environment, the following requirements must be
met:
  1. The merchant must be registered in IRISPayʼs production environment.
  2. A security key for integration with the production environment must be
     generated. Please follow the instructions for the Merchant portal to add
     a merchant account and object.
  3. Update the integration by replacing the URLs as follows:

                    Environment                                Type

 https://dev.paybyclick.irispay.bg                    Development

 https://paybyclick.irispay.bg                        Production


Support
For technical support or sandbox access, contact:
<PROVIDER_SUPPORT_EMAIL_PLACEHOLDER>
🌐 https://irisbgsf.com
```
