import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

type ValStrArr = { value: string }[];
type ValNumArr = { value: number }[];

function recArrToStr(arr?: ValStrArr | ValNumArr): string | undefined {
  return arr?.map((r) => r.value).join(", ");
}

interface APIResponse {
  company_name: string;
  device: {
    id?: ValNumArr;
    name: ValStrArr;
    field_apdo?: ValStrArr;
    field_total_wattage_from_ports?: ValNumArr;
    field_usb_cable_length?: ValNumArr;
    field_usb_product_revision?: ValStrArr;
    field_usb_model_part_number: ValStrArr;
    field_usb_type_c_role?: ValStrArr;
  };
  device_field_usb_spec_support?: string[];
  "device.field_e_marker_tid"?: string[];
  "device.field_usb_connector"?: string[];
  tid: string;
}

const deviceField = z.enum([
  "tid",
  "companyName",
  "name",
  "modelPartNumber",
  "id",
  "productRevision",
]);

const getDevicesInput = z
  .object({
    orderDirection: z.enum(["asc", "desc"]),
    orderBy: deviceField,
    queries: z.array(z.record(deviceField, z.string())),
  })
  .partial();

export const exampleRouter = createTRPCRouter({
  scrape: publicProcedure.mutation(async ({ ctx }) => {
    for (let i = 1; i < 9999; i++) {
      const tid = i.toLocaleString("en-US", {
        minimumIntegerDigits: 4,
        useGrouping: false,
      });
      console.log(`Scraping tid ${tid}...`);
      try {
        const response = await fetch(
          `https://www.usb.org/vtm-products/v1/single-product-data/${tid}`
        );

        const data = (await response.json()) as APIResponse;

        await ctx.prisma.device.create({
          data: {
            tid: data.tid,
            companyName: data.company_name,
            name: data.device.name.map((name) => name.value).join(", "),
            modelPartNumber:
              recArrToStr(data.device.field_usb_model_part_number) ?? "",
            productRevision: recArrToStr(
              data.device.field_usb_product_revision
            ),
            id: recArrToStr(data.device.id),
            totalWattageFromPorts: Number(
              recArrToStr(data.device.field_total_wattage_from_ports)
            ),
            usbConnector: data["device.field_usb_connector"]?.join(", "),
          },
        });

        console.log(`Successfully created tid ${tid}`);
      } catch {
        console.log(`Could not scrape tid ${tid}`);
      }
    }
  }),

  sanitize: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.device.deleteMany();
  }),

  get: publicProcedure.input(getDevicesInput).query(async ({ input, ctx }) => {
    return ctx.prisma.device.findMany({
      orderBy: { [input.orderBy ?? "tid"]: input.orderDirection ?? "asc" },
    });
  }),
});
