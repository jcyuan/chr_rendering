import type { gfx, Material, Texture2D } from "cc";

export interface PipelineSettings {
    shadingScale: number;
    enableShadingScale: boolean;
    readonly msaa: MSAASettings;
    readonly toneMapping: ToneMappingSettings;
    readonly bloom: BloomSettings;
    readonly colorGrading: ColorGradingSettings;
    readonly fsr: FSRSettings;
    readonly fxaa: FXAASettings;
}

export interface MSAASettings {
    enabled: boolean; /* false */
    sampleCount: gfx.SampleCount; /* SampleCount.X4 */
}

export interface BloomSettings {
    enabled: boolean; /* false */
    type: number; /* BloomType.KawaseDualFilter */
    material: Material | null;
    kawaseFilterMaterial: Material | null;
    mipmapFilterMaterial: Material | null;
    enableAlphaMask: boolean; /* false */
    iterations: number; /* 3 */
    threshold: number; /* 0.8 */
    intensity: number; /* 1 */
}

export interface ColorGradingSettings {
    enabled: boolean; /* false */
    material: Material | null;
    contribute: number; /* 1 */
    colorGradingMap: Texture2D | null;
}

export interface FSRSettings {
    enabled: boolean; /* false */
    material: Material | null;
    sharpness: number; /* 0.8 */
}

export interface FXAASettings {
    enabled: boolean; /* false */
    material: Material | null;
}

export interface ToneMappingSettings {
    material: Material | null; /* null - uses built-in utilMtl */
}
