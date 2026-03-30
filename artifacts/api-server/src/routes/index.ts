import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workflowsRouter from "./workflows";
import executionsRouter from "./executions";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/workflows", workflowsRouter);
router.use("/executions", executionsRouter);

export default router;
