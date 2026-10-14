import { createServerFn } from "@tanstack/react-start";
import { storeInput } from "@workspace/lib/restaurants/facts";
import {
	auditInput,
	batchImportInput,
	collectInput,
	correctionInput,
	importSnapshotInput,
	judgmentInput,
	publicationInput,
	recordInput,
	scheduleInput,
	verifyInput,
} from "@workspace/lib/restaurants/geo/contracts";
import { renderPilotHtml, renderPilotPdf } from "@workspace/lib/restaurants/geo/report";
import {
	auditChannel,
	draftCorrection,
	getGeoRecord,
	importManualSnapshot,
	importPilotBatch,
	installPilotBank,
	listGeoRecords,
	pilotReport,
	recordPublication,
	requestCollection,
	reviewPilotAnswer,
	saveGeoSchedule,
	verifyPublication,
} from "@workspace/lib/restaurants/geo/service";
import { requireAuthSession } from "@/lib/auth/helpers";

async function actor() {
	return (await requireAuthSession()).user.id;
}
function receipt(row: { id: string; kind: string; sha256: string }) {
	return { id: row.id, kind: row.kind, sha256: row.sha256 };
}
export const listGeoFn = createServerFn({ method: "GET" })
	.validator(storeInput)
	.handler(async ({ data }) => listGeoRecords(await actor(), data));
export const getGeoFn = createServerFn({ method: "GET" })
	.validator(recordInput)
	.handler(async ({ data }) => {
		const { payload, ...row } = await getGeoRecord(await actor(), data);
		return { ...row, payloadJson: JSON.stringify(payload) };
	});
export const installBankFn = createServerFn({ method: "POST" })
	.validator(storeInput)
	.handler(async ({ data }) => installPilotBank(await actor(), data).then(receipt));
export const collectGeoFn = createServerFn({ method: "POST" })
	.validator(collectInput)
	.handler(async ({ data }) => requestCollection(await actor(), data).then(receipt));
export const importSnapshotFn = createServerFn({ method: "POST" })
	.validator(importSnapshotInput)
	.handler(async ({ data }) => importManualSnapshot(await actor(), data).then(receipt));
export const auditGeoFn = createServerFn({ method: "POST" })
	.validator(auditInput)
	.handler(async ({ data }) => auditChannel(await actor(), data).then(receipt));
export const draftCorrectionFn = createServerFn({ method: "POST" })
	.validator(correctionInput)
	.handler(async ({ data }) => draftCorrection(await actor(), data).then(receipt));
export const publicationFn = createServerFn({ method: "POST" })
	.validator(publicationInput)
	.handler(async ({ data }) => recordPublication(await actor(), data).then(receipt));
export const verifyGeoFn = createServerFn({ method: "POST" })
	.validator(verifyInput)
	.handler(async ({ data }) => verifyPublication(await actor(), data).then(receipt));
export const importPilotFn = createServerFn({ method: "POST" })
	.validator(batchImportInput)
	.handler(async ({ data }) => importPilotBatch(await actor(), data).then(receipt));
export const reviewPilotFn = createServerFn({ method: "POST" })
	.validator(judgmentInput)
	.handler(async ({ data }) => reviewPilotAnswer(await actor(), data).then(receipt));
export const pilotReportFn = createServerFn({ method: "GET" })
	.validator(recordInput)
	.handler(async ({ data }) => JSON.stringify(await pilotReport(await actor(), data)));
export const scheduleGeoFn = createServerFn({ method: "POST" })
	.validator(scheduleInput)
	.handler(async ({ data }) => saveGeoSchedule(await actor(), data).then(receipt));
export const pilotExportFn = createServerFn({ method: "POST" })
	.validator(recordInput)
	.handler(async ({ data }) => {
		const report = await pilotReport(await actor(), data);
		const html = renderPilotHtml(report);
		return { filename: `${report.batch.batchId}.pdf`, base64: await renderPilotPdf(html) };
	});
