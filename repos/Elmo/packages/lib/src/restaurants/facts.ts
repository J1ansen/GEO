import { z } from "zod";

const shortText = z.string().trim().min(1).max(300);
const webUrl = z
	.url()
	.max(2000)
	.refine((value) => {
		try {
			const url = new URL(value);
			return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
		} catch {
			return false;
		}
	}, "请输入不含账号密码的 HTTP/HTTPS 链接");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const interval = z.object({ id: z.uuid(), open: clock, close: clock, closesNextDay: z.boolean() });
const dayHours = z
	.object({
		day: z.number().int().min(1).max(7),
		state: z.enum(["unknown", "closed", "open", "24h"]),
		intervals: z.array(interval).max(4),
	})
	.superRefine((day, ctx) => {
		if (day.state === "open" && day.intervals.length === 0)
			ctx.addIssue({ code: "custom", message: "营业日需要时间段" });
		if (day.state !== "open" && day.intervals.length > 0)
			ctx.addIssue({ code: "custom", message: "只有营业日可填写时间段" });
		for (const span of day.intervals) {
			if (!span.closesNextDay && span.close <= span.open)
				ctx.addIssue({ code: "custom", message: "结束时间需晚于开始时间，跨午夜请勾选次日" });
		}
	});
const menuItem = z.object({
	id: z.uuid(),
	name: shortText,
	price: z.number().min(0).max(100000),
	currency: z.string().regex(/^[A-Z]{3}$/),
	portion: shortText,
	validTimes: shortText,
	tax: z.enum(["included", "excluded", "unknown"]),
});

export const factSchemas = {
	identity: z.object({ name: shortText, nativeName: z.string().trim().max(300), aliases: z.array(shortText).max(30) }),
	location: z.object({
		address: shortText,
		city: shortText,
		region: z.string().trim().max(100),
		postalCode: z.string().trim().max(30),
		country: z.string().regex(/^[A-Z]{2}$/),
		timezone: shortText.refine((value) => {
			try {
				new Intl.DateTimeFormat("en", { timeZone: value });
				return true;
			} catch {
				return false;
			}
		}, "时区无效"),
	}),
	phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "电话请使用国际格式，例如 +19292436130"),
	website: webUrl,
	classification: z.object({ restaurantType: shortText, cuisines: z.array(shortText).min(1).max(20) }),
	hours: z.object({
		weekly: z
			.array(dayHours)
			.length(7)
			.refine((days) => new Set(days.map((day) => day.day)).size === 7, "每周需要七个不同日期"),
		holidayNote: z.string().max(2000),
	}),
	pricing: z.object({
		range: z.enum(["$", "$$", "$$$", "$$$$"]),
		currency: z.string().regex(/^[A-Z]{3}$/),
		note: z.string().max(1000),
	}),
	menu: z
		.object({ packages: z.array(menuItem).max(20), dishes: z.array(menuItem).max(10) })
		.refine((value) => value.packages.length + value.dishes.length > 0, "至少填写一项套餐或重点菜品"),
	actions: z
		.object({ reservationUrl: webUrl.nullable(), orderUrl: webUrl.nullable(), menuUrl: webUrl.nullable() })
		.refine((value) => Object.values(value).some(Boolean), "至少填写一个行动入口"),
	services: z.object({
		dineIn: z.enum(["yes", "no", "unknown"]),
		takeout: z.enum(["yes", "no", "unknown"]),
		delivery: z.enum(["yes", "no", "unknown"]),
		reservations: z.enum(["yes", "no", "unknown"]),
		notes: z.string().max(2000),
	}),
} as const;
export const factKeys = Object.keys(factSchemas) as (keyof typeof factSchemas)[];
export type FactKey = keyof typeof factSchemas;
export type FactValues = { [K in FactKey]: z.infer<(typeof factSchemas)[K]> };
export type Fact = {
	value: FactValues[FactKey] | null;
	status: "unknown" | "pending" | "confirmed";
	evidenceIds: string[];
};
export type Facts = Record<FactKey, Fact>;
export const factLabels: Record<FactKey, string> = {
	identity: "门店名称",
	location: "地址与时区",
	phone: "电话",
	website: "官网",
	classification: "餐厅类型与菜系",
	hours: "营业时间",
	pricing: "价格档位",
	menu: "套餐与重点菜品",
	actions: "预约、点单与菜单入口",
	services: "服务方式",
};
const factInput = z.object({
	value: z.union([z.null(), ...Object.values(factSchemas)]),
	status: z.enum(["unknown", "pending", "confirmed"]),
	evidenceIds: z.array(z.uuid()).max(30),
});
export const factsInput = z.record(z.enum(factKeys as [FactKey, ...FactKey[]]), factInput);
export const scopeInput = z.object({ organizationId: shortText });
export const storeInput = scopeInput.extend({ storeId: z.uuid() });
export const createStoreInput = scopeInput.extend({
	brandId: z.string().optional(),
	brandName: shortText.optional(),
	label: shortText,
});
export const saveDraftInput = storeInput.extend({ revision: z.number().int().min(0), facts: factsInput });
export const confirmInput = storeInput.extend({
	revision: z.number().int().min(0),
	fields: z.array(z.enum(factKeys as [FactKey, ...FactKey[]])).min(1),
	verifiedWith: shortText,
	note: z.string().trim().min(1).max(2000),
});
export const evidenceInput = storeInput.extend({
	title: shortText,
	sourceUrl: webUrl.nullable(),
	sourceKind: z.enum(["merchant_review", "official", "google_maps", "yelp", "tripadvisor", "apple_maps", "other"]),
	observedAt: z.iso.datetime({ offset: true }),
	text: z.string().trim().min(1).max(100000),
	attachment: z
		.object({
			filename: shortText,
			mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
			base64: z.string().max(2800000),
		})
		.nullable(),
});

export function emptyFacts(): Facts {
	return factsInput.parse(
		Object.fromEntries(factKeys.map((key) => [key, { value: null, status: "unknown", evidenceIds: [] }])),
	);
}

export function normalizeDraft(input: Facts, previous: Facts): Facts {
	const next = emptyFacts();
	for (const key of factKeys) {
		const field = input[key];
		if (field.value === null) continue;
		const value = factSchemas[key].parse(field.value);
		const evidenceIds = [...new Set(field.evidenceIds)].sort();
		const unchanged =
			JSON.stringify(value) === JSON.stringify(previous[key].value) &&
			JSON.stringify(evidenceIds) === JSON.stringify([...previous[key].evidenceIds].sort());
		next[key] = {
			value,
			evidenceIds,
			status: unchanged && previous[key].status === "confirmed" ? "confirmed" : "pending",
		};
	}
	return next;
}

export function confirmFacts(facts: Facts, fields: FactKey[]): Facts {
	const result = structuredClone(facts);
	for (const key of fields) {
		if (result[key].value === null || result[key].evidenceIds.length === 0)
			throw new Error(`${factLabels[key]}需要资料及至少一条核实证据`);
		result[key].status = "confirmed";
	}
	if (result.identity.status !== "confirmed" || result.location.status !== "confirmed")
		throw new Error("请先核实门店名称及地址，避免串店");
	return result;
}

export function canonicalExport(input: {
	storeId: string;
	brandId: string;
	version: number;
	confirmedAt: Date;
	facts: Facts;
}) {
	return {
		schema_version: "1.0.0",
		record_type: "restaurant_location",
		store_id: input.storeId,
		brand_id: input.brandId,
		fact_version: input.version,
		confirmed_at: input.confirmedAt.toISOString(),
		facts: Object.fromEntries(
			factKeys.map((key) => [key, input.facts[key].status === "confirmed" ? input.facts[key].value : null]),
		),
		field_status: Object.fromEntries(factKeys.map((key) => [key, input.facts[key].status])),
	};
}
