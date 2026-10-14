import { createFileRoute } from "@tanstack/react-router";
import { RestaurantWorkbench } from "@/components/restaurants/workbench";
import { pageHead } from "@/lib/route-head";

export const Route = createFileRoute("/_authed/app/org/$org/restaurants")({
	staticData: { crumb: "门店资料", shell: "organization" },
	head: pageHead({ title: "门店资料工作台", description: "核实餐厅资料、关联证据并管理事实版本。" }),
	component: RestaurantWorkbench,
});
