import { createServerFn } from "@tanstack/react-start";
import { getDeployment } from "@workspace/deployment";
import {
	confirmInput,
	createStoreInput,
	evidenceInput,
	saveDraftInput,
	scopeInput,
	storeInput,
} from "@workspace/lib/restaurants/facts";
import {
	addRestaurantEvidence,
	confirmRestaurantFacts,
	createRestaurantStore,
	exportRestaurantFacts,
	getRestaurantEvidence,
	getRestaurantStore,
	listRestaurantStores,
	saveRestaurantDraft,
} from "@workspace/lib/restaurants/service";
import { z } from "zod";
import { requireAuthSession } from "@/lib/auth/helpers";

async function actor(write = false) {
	const session = await requireAuthSession();
	if (write && getDeployment().mode !== "local") throw new Error("餐厅工作台 P1 当前仅在本地部署开放写入");
	return session.user.id;
}

export const listStoresFn = createServerFn({ method: "GET" })
	.validator(scopeInput)
	.handler(async ({ data }) => listRestaurantStores(await actor(), data.organizationId));
export const getStoreFn = createServerFn({ method: "GET" })
	.validator(storeInput)
	.handler(async ({ data }) => getRestaurantStore(await actor(), data));
export const createStoreFn = createServerFn({ method: "POST" })
	.validator(createStoreInput)
	.handler(async ({ data }) => createRestaurantStore(await actor(true), data));
export const saveDraftFn = createServerFn({ method: "POST" })
	.validator(saveDraftInput)
	.handler(async ({ data }) => saveRestaurantDraft(await actor(true), data));
export const confirmFactsFn = createServerFn({ method: "POST" })
	.validator(confirmInput)
	.handler(async ({ data }) => confirmRestaurantFacts(await actor(true), data));
export const addEvidenceFn = createServerFn({ method: "POST" })
	.validator(evidenceInput)
	.handler(async ({ data }) => addRestaurantEvidence(await actor(true), data));
export const getEvidenceFn = createServerFn({ method: "GET" })
	.validator(storeInput.extend({ evidenceId: z.uuid() }))
	.handler(async ({ data }) => getRestaurantEvidence(await actor(), data));
export const exportFactsFn = createServerFn({ method: "GET" })
	.validator(storeInput.extend({ version: z.number().int().min(1) }))
	.handler(async ({ data }) => exportRestaurantFacts(await actor(), data));
