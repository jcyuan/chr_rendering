import { rendering } from "cc";
import { XQPipeline } from "./xq-pipeline";

export abstract class PipelineBuilderBase implements rendering.PipelinePassBuilder {
    constructor(protected readonly _pipeline: XQPipeline) {}
    static readonly RenderOrder: number;
    abstract getConfigOrder(): number;
    abstract getRenderOrder(): number;
}
