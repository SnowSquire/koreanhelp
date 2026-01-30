/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import { Route, Router } from "@solidjs/router";
import App from "./App.tsx";
import StatsPage from "./pages/StatsPage.tsx";

const root = document.getElementById("root");

render(
	() => (
		<Router>
			<Route path={"/"} component={App} />
			<Route path={"/stats"} component={StatsPage} />
		</Router>
	),
	root!,
);
