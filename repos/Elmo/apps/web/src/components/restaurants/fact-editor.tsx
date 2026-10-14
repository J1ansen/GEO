import { type FactKey, type FactValues, factLabels } from "@workspace/lib/restaurants/facts";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { useId } from "react";
import { v4 as uuid } from "uuid";

export function TextField({
	label,
	value,
	onChange,
	type = "text",
	placeholder = "",
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: string;
	placeholder?: string;
}) {
	const id = useId();
	return (
		<label htmlFor={id} className="grid gap-1.5 text-sm">
			<span className="font-medium">{label}</span>
			<Input
				id={id}
				type={type}
				value={value}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}
export function Choice({
	label,
	value,
	onChange,
	options,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
}) {
	return (
		<label className="grid gap-1.5 text-sm">
			<span className="font-medium">{label}</span>
			<select
				className="h-9 rounded-md border bg-background px-2"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}

export const defaultValues: FactValues = {
	identity: { name: "", nativeName: "", aliases: [] },
	location: { address: "", city: "", region: "", postalCode: "", country: "US", timezone: "America/New_York" },
	phone: "",
	website: "",
	classification: { restaurantType: "", cuisines: [] },
	hours: {
		weekly: Array.from({ length: 7 }, (_, index) => ({ day: index + 1, state: "unknown", intervals: [] })),
		holidayNote: "",
	},
	pricing: { range: "$$", currency: "USD", note: "" },
	menu: { packages: [], dishes: [] },
	actions: { reservationUrl: null, orderUrl: null, menuUrl: null },
	services: { dineIn: "unknown", takeout: "unknown", delivery: "unknown", reservations: "unknown", notes: "" },
};

function StringObjectEditor({
	fields,
	value,
	onChange,
}: {
	fields: [string, string][];
	value: Record<string, string>;
	onChange: (value: Record<string, string>) => void;
}) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{fields.map(([key, label]) => (
				<TextField
					key={key}
					label={label}
					value={value[key] ?? ""}
					onChange={(text) => onChange({ ...value, [key]: text })}
				/>
			))}
		</div>
	);
}

function IdentityEditor({ value, onChange }: { value: FactValues["identity"]; onChange: (value: unknown) => void }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<TextField label="英文／对外店名" value={value.name} onChange={(name) => onChange({ ...value, name })} />
			<TextField
				label="中文／本地名称"
				value={value.nativeName}
				onChange={(nativeName) => onChange({ ...value, nativeName })}
			/>
			<TextField
				label="别名（逗号分隔）"
				value={value.aliases.join(",")}
				onChange={(text) => onChange({ ...value, aliases: text ? text.split(/[,，]/) : [] })}
			/>
		</div>
	);
}

function HoursEditor({ value, onChange }: { value: FactValues["hours"]; onChange: (value: unknown) => void }) {
	const updateDay = (index: number, patch: Partial<FactValues["hours"]["weekly"][number]>) =>
		onChange({ ...value, weekly: value.weekly.map((day, i) => (i === index ? { ...day, ...patch } : day)) });
	return (
		<div className="space-y-3">
			{value.weekly.map((day, index) => (
				<div key={day.day} className="rounded-lg border p-3 space-y-2">
					<Choice
						label={`星期${["一", "二", "三", "四", "五", "六", "日"][day.day - 1]}`}
						value={day.state}
						options={[
							{ value: "unknown", label: "未知" },
							{ value: "closed", label: "休息" },
							{ value: "open", label: "按时段营业" },
							{ value: "24h", label: "24 小时" },
						]}
						onChange={(state) =>
							updateDay(index, {
								state: state as typeof day.state,
								intervals:
									state === "open" ? [{ id: uuid(), open: "09:00", close: "21:00", closesNextDay: false }] : [],
							})
						}
					/>
					{day.intervals.map((span, position) => {
						const updateSpan = (patch: Partial<typeof span>) =>
							updateDay(index, {
								intervals: day.intervals.map((item, i) => (i === position ? { ...item, ...patch } : item)),
							});
						return (
							<div key={span.id} className="flex flex-wrap items-end gap-3">
								<TextField label="开始" type="time" value={span.open} onChange={(open) => updateSpan({ open })} />
								<TextField label="结束" type="time" value={span.close} onChange={(close) => updateSpan({ close })} />
								<label className="flex items-center gap-2 text-sm pb-2">
									<input
										type="checkbox"
										checked={span.closesNextDay}
										onChange={(event) => updateSpan({ closesNextDay: event.target.checked })}
									/>
									次日结束
								</label>
								<Button
									variant="ghost"
									type="button"
									onClick={() => updateDay(index, { intervals: day.intervals.filter((_, i) => i !== position) })}
								>
									移除此时段
								</Button>
							</div>
						);
					})}
					{day.state === "open" && day.intervals.length < 4 && (
						<Button
							type="button"
							variant="outline"
							onClick={() =>
								updateDay(index, {
									intervals: [...day.intervals, { id: uuid(), open: "17:00", close: "22:00", closesNextDay: false }],
								})
							}
						>
							添加时段
						</Button>
					)}
				</div>
			))}
			<TextField
				label="节假日安排（空白表示未核实）"
				value={value.holidayNote}
				onChange={(holidayNote) => onChange({ ...value, holidayNote })}
			/>
		</div>
	);
}

function MenuEditor({ value, onChange }: { value: FactValues["menu"]; onChange: (value: unknown) => void }) {
	return (
		<div className="space-y-5">
			{(["packages", "dishes"] as const).map((kind) => (
				<div key={kind} className="space-y-3">
					<h4 className="font-medium">{kind === "packages" ? "套餐／自助餐" : "重点菜品（最多 10 项）"}</h4>
					{value[kind].map((item, index) => {
						const update = (patch: Partial<typeof item>) =>
							onChange({ ...value, [kind]: value[kind].map((row, i) => (i === index ? { ...row, ...patch } : row)) });
						return (
							<div key={item.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
								<TextField label="名称" value={item.name} onChange={(name) => update({ name })} />
								<TextField
									label="价格"
									type="number"
									value={String(item.price)}
									onChange={(price) => update({ price: Number(price) })}
								/>
								<TextField
									label="币种"
									value={item.currency}
									onChange={(currency) => update({ currency: currency.toUpperCase() })}
								/>
								<TextField label="份量／适用人群" value={item.portion} onChange={(portion) => update({ portion })} />
								<TextField label="适用时段" value={item.validTimes} onChange={(validTimes) => update({ validTimes })} />
								<Choice
									label="税费口径"
									value={item.tax}
									options={[
										{ value: "unknown", label: "未知" },
										{ value: "included", label: "含税" },
										{ value: "excluded", label: "未含税" },
									]}
									onChange={(tax) => update({ tax: tax as typeof item.tax })}
								/>
								<Button
									type="button"
									variant="ghost"
									onClick={() => onChange({ ...value, [kind]: value[kind].filter((_, i) => i !== index) })}
								>
									删除此项
								</Button>
							</div>
						);
					})}
					<Button
						type="button"
						variant="outline"
						disabled={value[kind].length >= (kind === "packages" ? 20 : 10)}
						onClick={() =>
							onChange({
								...value,
								[kind]: [
									...value[kind],
									{
										id: uuid(),
										name: "",
										price: 0,
										currency: "USD",
										portion: "",
										validTimes: "",
										tax: "unknown",
									},
								],
							})
						}
					>
						添加{kind === "packages" ? "套餐" : "菜品"}
					</Button>
				</div>
			))}
		</div>
	);
}

export function FactEditor({
	field,
	value,
	onChange,
}: {
	field: FactKey;
	value: unknown;
	onChange: (value: unknown) => void;
}) {
	const notesId = useId();
	switch (field) {
		case "identity":
			return <IdentityEditor value={value as FactValues["identity"]} onChange={onChange} />;
		case "location":
			return (
				<StringObjectEditor
					fields={[
						["address", "街道地址"],
						["city", "城市"],
						["region", "州／省"],
						["postalCode", "邮编"],
						["country", "国家代码（US / CN 等）"],
						["timezone", "门店时区"],
					]}
					value={value as FactValues["location"]}
					onChange={onChange}
				/>
			);
		case "phone":
		case "website":
			return (
				<TextField
					label={factLabels[field]}
					value={value as string}
					onChange={onChange}
					placeholder={field === "phone" ? "+19292436130" : "https://"}
				/>
			);
		case "classification": {
			const data = value as FactValues["classification"];
			return (
				<div className="grid gap-4 sm:grid-cols-2">
					<TextField
						label="餐厅类型（自助、咖啡馆、快餐等）"
						value={data.restaurantType}
						onChange={(restaurantType) => onChange({ ...data, restaurantType })}
					/>
					<TextField
						label="菜系（逗号分隔）"
						value={data.cuisines.join(",")}
						onChange={(text) => onChange({ ...data, cuisines: text ? text.split(/[,，]/) : [] })}
					/>
				</div>
			);
		}
		case "hours":
			return <HoursEditor value={value as FactValues["hours"]} onChange={onChange} />;
		case "pricing": {
			const data = value as FactValues["pricing"];
			return (
				<div className="grid gap-4 sm:grid-cols-2">
					<Choice
						label="价格档位"
						value={data.range}
						options={["$", "$$", "$$$", "$$$$"].map((range) => ({ value: range, label: range }))}
						onChange={(range) => onChange({ ...data, range })}
					/>
					<TextField label="币种" value={data.currency} onChange={(currency) => onChange({ ...data, currency })} />
					<TextField label="价格说明" value={data.note} onChange={(note) => onChange({ ...data, note })} />
				</div>
			);
		}
		case "menu":
			return <MenuEditor value={value as FactValues["menu"]} onChange={onChange} />;
		case "actions": {
			const data = value as FactValues["actions"];
			return (
				<div className="grid gap-4">
					{(
						[
							["reservationUrl", "预约链接"],
							["orderUrl", "点单链接"],
							["menuUrl", "菜单链接"],
						] as const
					).map(([key, label]) => (
						<TextField
							key={key}
							label={label}
							value={data[key] ?? ""}
							onChange={(text) => onChange({ ...data, [key]: text || null })}
						/>
					))}
				</div>
			);
		}
		case "services": {
			const data = value as FactValues["services"];
			return (
				<div className="grid gap-4 sm:grid-cols-2">
					{(
						[
							["dineIn", "堂食"],
							["takeout", "自取"],
							["delivery", "外送"],
							["reservations", "接受预约"],
						] as const
					).map(([key, label]) => (
						<Choice
							key={key}
							label={label}
							value={data[key]}
							options={[
								{ value: "unknown", label: "未知" },
								{ value: "yes", label: "有" },
								{ value: "no", label: "无" },
							]}
							onChange={(text) => onChange({ ...data, [key]: text })}
						/>
					))}
					<label htmlFor={notesId} className="grid gap-1.5 text-sm">
						服务与场景补充
						<Textarea
							id={notesId}
							value={data.notes}
							onChange={(event) => onChange({ ...data, notes: event.target.value })}
						/>
					</label>
				</div>
			);
		}
	}
}
