import { OperationsDashboardComponent } from "./operations/operations-dashboard.component";
import { appRoutePaths } from "./app-route-paths.const";

export const routes = [
  { path: appRoutePaths.operations + "/dashboard", component: OperationsDashboardComponent },
  { path: "**", redirectTo: appRoutePaths.home, pathMatch: "full" },
];
