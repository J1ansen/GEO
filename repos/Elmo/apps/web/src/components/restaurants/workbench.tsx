import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import {
	emptyFacts,
	type FactKey,
	type Facts,
	factKeys,
	factLabels,
	factsInput,
} from "@workspace/lib/restaurants/facts";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { useEffect, useId, useState } from "react";
import { useOrganization, useOrganizationsChanged } from "@/hooks/use-organizations";
import {
	addEvidenceFn,
	confirmFactsFn,
	createStoreFn,
	exportFactsFn,
	getEvidenceFn,
	getStoreFn,
	listStoresFn,
	saveDraftFn,
} from "@/server/restaurants";
import { Choice, defaultValues, FactEditor, TextField } from "./fact-editor";
import { GeoPanel } from "./geo-panel";

type StoreData = Awaited<ReturnType<typeof getStoreFn>>;
type Scope = { organizationId: string; storeId: string };
const statuses = { unknown: "未知", pending: "待核实", confirmed: "已确认" };
const sourceOptions = [
	{ value: "merchant_review", label: "门店负责人核实" },
	{ value: "official", label: "官网资料" },
	{ value: "google_maps", label: "Google Maps" },
	{ value: "yelp", label: "Yelp" },
	{ value: "tripadvisor", label: "Tripadvisor" },
	{ value: "apple_maps", label: "Apple Maps" },
	{ value: "other", label: "其他来源" },
];
const date = (value: Date) => new Date(value).toLocaleString("zh-CN");

function useAction() {
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	async function run(action: () => Promise<unknown>, success: string) {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await action();
			setMessage(success);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "操作失败，请重试");
		} finally {
			setBusy(false);
		}
	}
	return {
		busy,
		run,
		feedback: (
			<div aria-live="polite">
				{error && (
					<p
						role="alert"
						className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 whitespace-pre-wrap"
					>
						{error}
					</p>
				)}
				{message && (
					<p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>
				)}
			</div>
		),
	};
}

function download(name: string, data: BlobPart, mime: string) {
	const url = URL.createObjectURL(new Blob([data], { type: mime }));
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RestaurantWorkbench() {
	const organization = useOrganization();
	const orgChanged = useOrganizationsChanged();
	const client = useQueryClient();
	const [selected, setSelected] = useState("");
	const [hasUnsaved, setHasUnsaved] = useState(false);
	const [creating, setCreating] = useState(false);
	const [brandId, setBrandId] = useState("");
	const [brandName, setBrandName] = useState("");
	const [label, setLabel] = useState("");
	const action = useAction();
	const query = useQuery({
		queryKey: ["restaurants", organization.id],
		queryFn: () => listStoresFn({ data: { organizationId: organization.id } }),
	});
	async function create() {
		const store = await createStoreFn({
			data: { organizationId: organization.id, label, ...(brandId ? { brandId } : { brandName }) },
		});
		await client.invalidateQueries({ queryKey: ["restaurants", organization.id] });
		setCreating(false);
		setSelected(store.id);
		setLabel("");
		setBrandName("");
		await orgChanged();
	}
	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p className="mb-2 text-xs font-semibold tracking-widest text-emerald-700">RESTAURANT GEO · P1</p>
					<h1 className="text-3xl font-bold tracking-tight">门店资料工作台</h1>
					<p className="mt-2 text-sm text-muted-foreground">建立门店 → 核实证据 → 确认版本 → 导出标准资料</p>
				</div>
				<Button disabled={hasUnsaved} onClick={() => setCreating(!creating)}>
					{creating ? "收起新建" : "新建门店"}
				</Button>
			</header>
			{action.feedback}
			{creating && (
				<form
					className="rounded-xl border bg-card p-5 space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						void action.run(create, "门店档案已创建，资料等待核实");
					}}
				>
					<h2 className="font-semibold">新建门店档案</h2>
					<fieldset disabled={action.busy} className="grid gap-4 sm:grid-cols-2">
						<Choice
							label="所属品牌"
							value={brandId}
							onChange={setBrandId}
							options={[
								{ value: "", label: "新建品牌" },
								...(query.data?.brands.map((brand) => ({ value: brand.id, label: brand.name })) ?? []),
							]}
						/>
						{!brandId && (
							<TextField label="品牌名称" value={brandName} onChange={setBrandName} placeholder="例如 Easy Joy" />
						)}
						<TextField label="门店标识" value={label} onChange={setLabel} placeholder="例如 Easy Joy · Mulberry St" />
						<div className="flex items-end">
							<Button type="submit" disabled={!label.trim() || (!brandId && !brandName.trim())}>
								创建档案
							</Button>
						</div>
					</fieldset>
					<p className="text-xs text-muted-foreground">
						同品牌的不同地址请分别建店。可以没有官网；新建品牌不会启动 AI 查询。
					</p>
				</form>
			)}
			{query.isPending && <p>正在加载门店…</p>}
			{query.error && <p role="alert">{query.error.message}</p>}
			{query.data && (
				<div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
					<aside className="space-y-3">
						<p className="text-sm font-medium">{query.data.stores.length} 家门店</p>
						{query.data.stores.length === 0 && (
							<p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
								先建立第一家门店。名称、地址及营业信息都由证据确认后进入标准版本。
							</p>
						)}
						{query.data.stores.map((store) => (
							<button
								type="button"
								key={store.id}
								disabled={hasUnsaved && selected !== store.id}
								onClick={() => setSelected(store.id)}
								className={`w-full rounded-xl border p-4 text-left transition-colors ${selected === store.id ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "bg-card hover:bg-muted"}`}
							>
								<span className="block font-semibold break-words">{store.label}</span>
								<span className="mt-1 block text-xs opacity-75">{store.brandName}</span>
								<span className="mt-3 block text-xs">
									{store.currentVersion ? `已确认至 V${store.currentVersion}` : "尚无确认版本"}
								</span>
							</button>
						))}
					</aside>
					<main className="min-w-0">
						{selected ? (
							<StorePanel
								key={selected}
								scope={{ organizationId: organization.id, storeId: selected }}
								canConfirm={query.data.canConfirm}
								onDirty={setHasUnsaved}
							/>
						) : (
							<div className="rounded-xl border bg-card p-8">
								<h2 className="text-xl font-semibold">从一家门店开始</h2>
								<p className="mt-3 text-sm text-muted-foreground">
									选择左侧档案或新建门店。P1 管理事实和证据；渠道自动诊断与 AI 回答统计会在后续阶段接入。
								</p>
							</div>
						)}
					</main>
				</div>
			)}
		</div>
	);
}

function StorePanel({
	scope,
	canConfirm,
	onDirty,
}: {
	scope: Scope;
	canConfirm: boolean;
	onDirty: (dirty: boolean) => void;
}) {
	const query = useQuery({ queryKey: ["restaurant", scope.storeId], queryFn: () => getStoreFn({ data: scope }) });
	if (query.isPending) return <p>正在读取资料…</p>;
	if (query.error) return <p role="alert">{query.error.message}</p>;
	return <StoreDetail key={scope.storeId} scope={scope} data={query.data} canConfirm={canConfirm} onDirty={onDirty} />;
}

function StoreDetail({
	scope,
	data,
	canConfirm,
	onDirty,
}: {
	scope: Scope;
	data: StoreData;
	canConfirm: boolean;
	onDirty: (dirty: boolean) => void;
}) {
	const noteId = useId();
	const [baseline, setBaseline] = useState(data.store);
	const [tab, setTab] = useState("facts");
	const [facts, setFacts] = useState<Facts>(() => structuredClone(data.store.draft));
	const [fields, setFields] = useState<FactKey[]>([]);
	const [verifiedWith, setVerifiedWith] = useState("");
	const [note, setNote] = useState("");
	const action = useAction();
	const client = useQueryClient();
	const dirty = JSON.stringify(facts) !== JSON.stringify(baseline.draft);
	useBlocker({
		shouldBlockFn: () => dirty && !window.confirm("资料尚未保存，确定离开并丢弃修改？"),
		enableBeforeUnload: () => dirty,
	});
	useEffect(() => {
		onDirty(dirty);
		return () => onDirty(false);
	}, [dirty, onDirty]);
	const confirmed = factKeys.filter((key) => data.store.draft[key].status === "confirmed").length;
	async function refresh() {
		await Promise.all([
			client.invalidateQueries({ queryKey: ["restaurant", scope.storeId] }),
			client.invalidateQueries({ queryKey: ["restaurants", scope.organizationId] }),
		]);
	}
	function patch(key: FactKey, update: Partial<Facts[FactKey]>) {
		setFacts((current) => ({ ...current, [key]: { ...current[key], ...update } }));
		setFields((current) => current.filter((field) => field !== key));
	}
	async function save() {
		const saved = await saveDraftFn({
			data: { ...scope, revision: baseline.revision, facts: factsInput.parse(facts) },
		});
		setBaseline(saved);
		setFacts(structuredClone(saved.draft));
		setFields([]);
		await refresh();
	}
	async function confirm() {
		const version = await confirmFactsFn({
			data: { ...scope, revision: baseline.revision, fields, verifiedWith, note },
		});
		setBaseline({
			...baseline,
			draft: version.facts,
			revision: baseline.revision + 1,
			currentVersion: version.version,
		});
		setFacts(structuredClone(version.facts));
		setFields([]);
		setVerifiedWith("");
		setNote("");
		await refresh();
	}
	return (
		<div className="space-y-5">
			<div className="rounded-xl border bg-card p-5">
				<h2 className="text-xl font-semibold">{data.store.label}</h2>
				<div className="mt-3 flex flex-wrap gap-2 text-xs">
					<span className="rounded-full bg-muted px-3 py-1">
						{confirmed} / {factKeys.length} 类资料已确认
					</span>
					<span className="rounded-full bg-muted px-3 py-1">
						当前标准：{data.store.currentVersion ? `V${data.store.currentVersion}` : "未建立"}
					</span>
					<span className="rounded-full bg-muted px-3 py-1">{data.evidence.length} 条证据</span>
					{dirty && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">有未保存修改</span>}
				</div>
			</div>
			<nav className="flex flex-wrap gap-2" aria-label="门店档案栏目">
				{[
					{ id: "facts", title: "资料与确认" },
					{ id: "evidence", title: "证据记录" },
					{ id: "history", title: "版本与导出" },
					{ id: "geo", title: "GEO 试点" },
				].map((item) => (
					<Button key={item.id} variant={tab === item.id ? "default" : "outline"} onClick={() => setTab(item.id)}>
						{item.title}
					</Button>
				))}
			</nav>
			{action.feedback}
			{data.store.revision > baseline.revision && (
				<div className="rounded-lg border border-amber-300 p-3 text-sm">
					服务器资料已更新，本地编辑仍保留。
					<Button
						variant="outline"
						onClick={() => {
							if (!dirty || window.confirm("重新载入会丢弃未保存修改，是否继续？")) {
								setBaseline(data.store);
								setFacts(structuredClone(data.store.draft));
								setFields([]);
							}
						}}
					>
						载入最新草稿
					</Button>
				</div>
			)}
			{tab === "facts" && (
				<fieldset disabled={action.busy} className="space-y-4">
					<p className="text-sm text-muted-foreground">
						先附上门店核实材料，再将证据关联到资料。未开启的栏目保持“未知”；保存草稿不会改变标准版本。
					</p>
					{factKeys.map((key) => (
						<details
							key={key}
							className="rounded-xl border bg-card p-4"
							open={key === "identity" || key === "location" ? true : undefined}
						>
							<summary className="cursor-pointer font-semibold">
								{factLabels[key]}
								<span className="ml-3 text-xs font-normal text-muted-foreground">{statuses[facts[key].status]}</span>
							</summary>
							<div className="mt-4 space-y-4">
								<label className="flex gap-2 text-sm">
									<input
										type="checkbox"
										checked={facts[key].value !== null}
										onChange={(event) =>
											patch(
												key,
												event.target.checked
													? { value: structuredClone(defaultValues[key]), status: "pending" }
													: emptyFacts()[key],
											)
										}
									/>
									填写此项资料
								</label>
								{facts[key].value !== null && (
									<>
										<FactEditor
											field={key}
											value={facts[key].value}
											onChange={(value) => patch(key, { value: value as Facts[FactKey]["value"], status: "pending" })}
										/>
										<div className="rounded-lg bg-muted/50 p-3 space-y-2">
											<p className="text-xs font-semibold">支持此项的证据</p>
											{data.evidence.length === 0 && (
												<p className="text-xs text-muted-foreground">尚无证据。请先在“证据记录”添加门店核实材料。</p>
											)}
											{data.evidence.map((item) => (
												<label key={item.id} className="flex items-start gap-2 text-sm">
													<input
														type="checkbox"
														className="mt-1"
														checked={facts[key].evidenceIds.includes(item.id)}
														onChange={(event) =>
															patch(key, {
																evidenceIds: event.target.checked
																	? [...facts[key].evidenceIds, item.id]
																	: facts[key].evidenceIds.filter((id) => id !== item.id),
																status: "pending",
															})
														}
													/>
													<span>
														{item.title}
														<span className="ml-2 text-xs text-muted-foreground">{date(item.observedAt)}</span>
													</span>
												</label>
											))}
										</div>
										{canConfirm && (
											<label className="flex gap-2 text-sm font-medium text-emerald-700">
												<input
													type="checkbox"
													disabled={dirty || facts[key].evidenceIds.length === 0}
													checked={fields.includes(key)}
													onChange={(event) =>
														setFields(event.target.checked ? [...fields, key] : fields.filter((field) => field !== key))
													}
												/>
												本次已与门店核实此项（保存后勾选）
											</label>
										)}
									</>
								)}
							</div>
						</details>
					))}
					<div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-sm">
						<span className="text-sm text-muted-foreground">{dirty ? "请保存或撤销修改后切换门店" : "草稿已保存"}</span>
						{dirty && (
							<Button
								variant="outline"
								onClick={() => {
									setFacts(structuredClone(baseline.draft));
									setFields([]);
								}}
							>
								撤销未保存修改
							</Button>
						)}
						<Button onClick={() => void action.run(save, "草稿已保存")} disabled={!dirty}>
							保存草稿
						</Button>
					</div>
					<div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
						<h3 className="font-semibold">确认形成新版本</h3>
						<p className="text-sm text-muted-foreground">
							门店名称及地址必须已核实。仅勾选本次确认的项目，其余资料保留原状态；确认后版本与证据不可覆盖。
						</p>
						{canConfirm ? (
							<>
								<TextField label="与哪位门店负责人核实" value={verifiedWith} onChange={setVerifiedWith} />
								<label htmlFor={noteId} className="grid gap-2 text-sm">
									确认说明
									<Textarea
										id={noteId}
										value={note}
										onChange={(event) => setNote(event.target.value)}
										placeholder="说明核实方式、日期和本次变化"
									/>
								</label>
								<Button
									disabled={dirty || fields.length === 0 || !verifiedWith.trim() || !note.trim()}
									onClick={() => void action.run(confirm, "新事实版本已确认")}
								>
									确认 {fields.length} 项并建立 V{data.store.currentVersion + 1}
								</Button>
							</>
						) : (
							<p className="text-sm">请组织管理员完成版本确认。</p>
						)}
					</div>
				</fieldset>
			)}
			{tab === "evidence" && <EvidencePanel scope={scope} evidence={data.evidence} onSaved={refresh} />}
			{tab === "history" && <VersionPanel scope={scope} versions={data.versions} />}
			{tab === "geo" && <GeoPanel scope={scope} factVersion={data.store.currentVersion} canConfirm={canConfirm} />}
		</div>
	);
}

function EvidencePanel({
	scope,
	evidence,
	onSaved,
}: {
	scope: Scope;
	evidence: StoreData["evidence"];
	onSaved: () => Promise<void>;
}) {
	const textId = useId();
	const [title, setTitle] = useState("");
	const [sourceKind, setSourceKind] = useState("merchant_review");
	const [sourceUrl, setSourceUrl] = useState("");
	const [text, setText] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [observedAt, setObservedAt] = useState(() => {
		const now = new Date();
		return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
	});
	const [detail, setDetail] = useState<Awaited<ReturnType<typeof getEvidenceFn>> | null>(null);
	const action = useAction();
	async function add() {
		if (file && file.size > 2 * 1024 * 1024) throw new Error("附件不能超过 2 MB");
		const attachment = file
			? {
					filename: file.name,
					mime: file.type as "image/png" | "image/jpeg" | "application/pdf",
					base64: await new Promise<string>((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(String(reader.result).split(",")[1]);
						reader.onerror = reject;
						reader.readAsDataURL(file);
					}),
				}
			: null;
		await addEvidenceFn({
			data: {
				...scope,
				title,
				sourceKind: sourceKind as "merchant_review",
				sourceUrl: sourceUrl || null,
				observedAt: new Date(observedAt).toISOString(),
				text,
				attachment,
			},
		});
		setTitle("");
		setText("");
		setSourceUrl("");
		setFile(null);
		await onSaved();
	}
	function saveAttachment() {
		if (!detail?.attachment) return;
		const attachment = detail.attachment;
		download(
			attachment.filename,
			Uint8Array.from(atob(attachment.base64), (character) => character.charCodeAt(0)),
			attachment.mime,
		);
	}
	return (
		<div className="space-y-5">
			{action.feedback}
			<form
				className="rounded-xl border bg-card p-5 space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					void action.run(add, "证据已保存，可以在资料中关联");
				}}
			>
				<h3 className="font-semibold">添加核实证据</h3>
				<p className="text-sm text-muted-foreground">
					用于人工复核的记录与附件。自动渠道采集将在 P2 接入；这里的记录不计为自动采集结果。
				</p>
				<fieldset disabled={action.busy} className="space-y-4">
					<TextField label="证据标题" value={title} onChange={setTitle} />
					<div className="grid gap-4 sm:grid-cols-2">
						<Choice label="来源" value={sourceKind} onChange={setSourceKind} options={sourceOptions} />
						<TextField
							label="资料采集／核实时间（本机时区）"
							type="datetime-local"
							value={observedAt}
							onChange={setObservedAt}
						/>
					</div>
					<TextField label="来源链接（可选）" value={sourceUrl} onChange={setSourceUrl} placeholder="https://" />
					<label htmlFor={textId} className="grid gap-2 text-sm">
						原始摘录／核实记录
						<Textarea
							id={textId}
							rows={5}
							value={text}
							onChange={(event) => setText(event.target.value)}
							placeholder="记录负责人确认了什么；保留原文及口径，不填写密码或登录信息"
						/>
					</label>
					<label className="grid gap-2 text-sm">
						附件（PNG、JPG 或 PDF，最大 2 MB）
						<input
							key={file?.name ?? "empty"}
							type="file"
							accept="image/png,image/jpeg,application/pdf"
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						/>
					</label>
					<Button type="submit" disabled={!title.trim() || !text.trim()}>
						保存证据
					</Button>
				</fieldset>
			</form>
			{evidence.map((item) => (
				<div key={item.id} className="rounded-xl border p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h4 className="font-medium">{item.title}</h4>
						<Button
							variant="outline"
							disabled={action.busy}
							onClick={() =>
								void action.run(
									async () => setDetail(await getEvidenceFn({ data: { ...scope, evidenceId: item.id } })),
									"",
								)
							}
						>
							查看原始证据
						</Button>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">
						{sourceOptions.find((option) => option.value === item.sourceKind)?.label} · {date(item.observedAt)}
					</p>
					{item.sourceUrl && (
						<a
							href={item.sourceUrl}
							target="_blank"
							rel="noreferrer"
							className="mt-2 block break-all text-sm text-emerald-700 underline"
						>
							{item.sourceUrl}
						</a>
					)}
				</div>
			))}
			{detail && (
				<section className="rounded-xl border bg-muted/30 p-5 space-y-3">
					<h3 className="font-semibold">{detail.title}</h3>
					<p className="whitespace-pre-wrap break-words text-sm">{detail.text}</p>
					<p className="text-xs text-muted-foreground break-all">内容校验 SHA-256：{detail.sha256}</p>
					{detail.attachment && (
						<Button variant="outline" onClick={saveAttachment}>
							下载附件：{detail.attachment.filename}
						</Button>
					)}
				</section>
			)}
		</div>
	);
}

function VersionPanel({ scope, versions }: { scope: Scope; versions: StoreData["versions"] }) {
	const action = useAction();
	async function exportVersion(version: number) {
		const result = await exportFactsFn({ data: { ...scope, version } });
		download(`store_data.v${version}.json`, JSON.stringify(result, null, 2), "application/json");
	}
	return (
		<div className="space-y-4">
			{action.feedback}
			<p className="text-sm text-muted-foreground">
				每个版本固定保存当时的值、核实人和证据关联。导出仅含已确认值；待核实和未知值导出为空，内部核实记录不公开。
			</p>
			{versions.length === 0 && (
				<div className="rounded-xl border border-dashed p-6 text-sm">
					尚无确认版本。请先保存资料、关联证据并完成确认。
				</div>
			)}
			{versions.map((version, index) => {
				const previous = versions[index + 1];
				const changed = factKeys.filter(
					(key) => !previous || JSON.stringify(version.facts[key]) !== JSON.stringify(previous.facts[key]),
				);
				return (
					<article key={version.id} className="rounded-xl border bg-card p-5 space-y-4">
						<div className="flex flex-wrap justify-between gap-3">
							<div>
								<h3 className="font-semibold">事实版本 V{version.version}</h3>
								<p className="mt-1 text-xs text-muted-foreground">
									{date(version.confirmedAt)} · 确认人 {version.confirmedByName}
								</p>
							</div>
							<Button
								variant="outline"
								disabled={action.busy}
								onClick={() => void action.run(() => exportVersion(version.version), "标准资料已生成下载")}
							>
								下载 V{version.version} 标准资料
							</Button>
						</div>
						<p className="text-sm">核实对象：{version.verifiedWith}</p>
						<p className="whitespace-pre-wrap text-sm">{version.note}</p>
						<p className="text-xs text-muted-foreground">
							{previous ? `相较 V${previous.version} 变化` : "首个版本"}：
							{changed.map((key) => factLabels[key]).join("、") || "仅重新核实"}
						</p>
						{factKeys.map((key) => (
							<details key={key} className="rounded-md border p-3">
								<summary className="cursor-pointer text-sm">
									{factLabels[key]} · {statuses[version.facts[key].status]} · {version.facts[key].evidenceIds.length}{" "}
									条证据
								</summary>
								<fieldset disabled className="mt-3 space-y-3">
									{version.facts[key].value === null ? (
										<p className="text-sm text-muted-foreground">未知</p>
									) : (
										<FactEditor field={key} value={version.facts[key].value} onChange={() => {}} />
									)}
								</fieldset>
								<p className="mt-2 text-xs text-muted-foreground break-all">
									证据编号：{version.facts[key].evidenceIds.join("、") || "无"}
								</p>
								{version.facts[key].evidenceIds.length > 0 && (
									<HistoricalEvidence scope={scope} ids={version.facts[key].evidenceIds} />
								)}
							</details>
						))}
					</article>
				);
			})}
		</div>
	);
}

function HistoricalEvidence({ scope, ids }: { scope: Scope; ids: string[] }) {
	const action = useAction();
	const [records, setRecords] = useState<Awaited<ReturnType<typeof getEvidenceFn>>[]>([]);
	return (
		<div className="mt-3 space-y-3">
			{action.feedback}
			<Button
				type="button"
				variant="outline"
				disabled={action.busy}
				onClick={() =>
					void action.run(
						async () =>
							setRecords(await Promise.all(ids.map((evidenceId) => getEvidenceFn({ data: { ...scope, evidenceId } })))),
						"",
					)
				}
			>
				查看本项原始证据
			</Button>
			{records.map((record) => (
				<section key={record.id} className="rounded-lg bg-muted/40 p-3 space-y-2">
					<h4 className="text-sm font-medium">{record.title}</h4>
					<p className="text-xs text-muted-foreground">{date(record.observedAt)}</p>
					<p className="whitespace-pre-wrap break-words text-sm">{record.text}</p>
					{record.sourceUrl && (
						<a className="break-all text-sm underline" href={record.sourceUrl} target="_blank" rel="noreferrer">
							来源链接
						</a>
					)}
					<p className="break-all text-xs text-muted-foreground">SHA-256：{record.sha256}</p>
				</section>
			))}
		</div>
	);
}
