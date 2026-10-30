import { describe, expect, it } from "vitest";
import { SUBSCRIBER_CSV_HEADER, subscribersCsv, toCsv } from "@/lib/admin/csv";

describe("toCsv", () => {
  it("joins rows with CRLF and quotes fields that need it", () => {
    expect(toCsv([["a", "b"], ["c,d", 'say "hi"'], ["line\nbreak", ""]])).toBe(
      'a,b\r\n"c,d","say ""hi"""\r\n"line\nbreak",\r\n',
    );
  });

  it("neutralises values a spreadsheet would run as a formula", () => {
    expect(toCsv([["=1+1", "+x", "-y", "@z", "\tq", "ok"]])).toBe("'=1+1,'+x,'-y,'@z,'\tq,ok\r\n");
  });
});

describe("subscribersCsv", () => {
  it("has the header email,status,createdAt and ISO timestamps", () => {
    const csv = subscribersCsv([
      { email: "a@example.com", status: "CONFIRMED", createdAt: new Date("2026-10-01T12:00:00Z") },
      { email: "b@example.com", status: "PENDING", createdAt: new Date("2026-10-02T08:30:00Z") },
    ]);
    expect(SUBSCRIBER_CSV_HEADER).toEqual(["email", "status", "createdAt"]);
    expect(csv).toBe(
      "email,status,createdAt\r\na@example.com,CONFIRMED,2026-10-01T12:00:00.000Z\r\nb@example.com,PENDING,2026-10-02T08:30:00.000Z\r\n",
    );
  });

  it("is just the header when there is nobody", () => {
    expect(subscribersCsv([])).toBe("email,status,createdAt\r\n");
  });
});
