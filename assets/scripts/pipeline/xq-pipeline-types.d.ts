import type { Material, Texture2D } from "cc";

export interface IPipelineSettings {
    shadingScale: number;
    enableShadingScale: boolean;
    readonly toneMapping: IToneMappingSettings;
    readonly bloom: IBloomSettings;
    readonly colorGrading: IColorGradingSettings;
    readonly fsr: IFSRSettings;
    readonly fxaa: IFXAASettings;
    readonly skin: ISkinSettings;
}

export interface IBloomSettings {
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

export interface IColorGradingSettings {
    enabled: boolean; /* false */
    material: Material | null;
    contribute: number; /* 1 */
    colorGradingMap: Texture2D | null;
}

export interface IFSRSettings {
    enabled: boolean; /* false */
    material: Material | null;
    sharpness: number; /* 0.8 */
}

export interface IFXAASettings {
    enabled: boolean; /* false */
    material: Material | null;
}

export interface IToneMappingSettings {
    material: Material | null; /* null - uses built-in utilMtl */
}

export interface ISkinSettings {
    sssQuality: number; /* SSSQuality.High */
    sssLutTexture: Texture2D | null; /* null */
}
