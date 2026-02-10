import { _decorator, Enum, Material, Texture2D } from "cc";
import { IBloomSettings, IColorGradingSettings, IFSRSettings, IFXAASettings, ISSSSettings, IToneMappingSettings } from "./xq-pipeline-types";

const { ccclass, property } = _decorator;

export enum BloomType {
    KawaseDualFilter,
    MipmapFilter,
}
const BloomTypeEnum = Enum(BloomType);

export interface IPropertyNotifier {
    onPropertyChanged(target: any, property: string, value: any): void;
}

export interface IPostEffectConfig {
    readonly willModifyScreenColor: boolean;
    readonly renderOrder: number;
}

@ccclass('BloomSettings')
export class BloomSettings implements IBloomSettings, IPostEffectConfig {
    readonly willModifyScreenColor = false;
    readonly renderOrder = 0;

    constructor(private _proxy: IPropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'bloom.enabled', v);
    }

    @property({ type: BloomTypeEnum })
    private _type = BloomType.KawaseDualFilter;
    @property({ type: BloomTypeEnum })
    get type() {
        return this._type;
    }
    set type(v: BloomType) {
        this._type = v;
        this._proxy?.onPropertyChanged(this, 'bloom.type', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'bloom.material', v);
    }

    @property({ type: Material })
    private _kawaseFilterMaterial = null;
    @property({ type: Material })
    get kawaseFilterMaterial() {
        return this._kawaseFilterMaterial;
    }
    set kawaseFilterMaterial(v: Material) {
        this._kawaseFilterMaterial = v;
        this._proxy?.onPropertyChanged(this, 'bloom.kawaseFilterMaterial', v);
    }

    @property({ type: Material })
    private _mipmapFilterMaterial = null;
    @property({ type: Material })
    get mipmapFilterMaterial() {
        return this._mipmapFilterMaterial;
    }
    set mipmapFilterMaterial(v: Material) {
        this._mipmapFilterMaterial = v;
        this._proxy?.onPropertyChanged(this, 'bloom.mipmapFilterMaterial', v);
    }

    @property
    private _enableAlphaMask = false;
    @property
    get enableAlphaMask() {
        return this._enableAlphaMask;
    }
    set enableAlphaMask(v: boolean) {
        this._enableAlphaMask = v;
        this._proxy?.onPropertyChanged(this, 'bloom.enableAlphaMask', v);
    }

    @property
    private _iterations = 3;
    @property
    get iterations() {
        return this._iterations;
    }
    set iterations(v: number) {
        this._iterations = v;
        this._proxy?.onPropertyChanged(this, 'bloom.iterations', v);
    }

    @property
    private _threshold = 0.8;
    @property
    get threshold() {
        return this._threshold;
    }
    set threshold(v: number) {
        this._threshold = v;
        this._proxy?.onPropertyChanged(this, 'bloom.threshold', v);
    }

    @property
    private _intensity = 1;
    @property
    get intensity() {
        return this._intensity;
    }
    set intensity(v: number) {
        this._intensity = v;
        this._proxy?.onPropertyChanged(this, 'bloom.intensity', v);
    }
}

@ccclass('ColorGradingSettings')
export class ColorGradingSettings implements IColorGradingSettings, IPostEffectConfig {
    readonly willModifyScreenColor = false;
    readonly renderOrder = 100;

    constructor(private _proxy: IPropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'colorGrading.enabled', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'colorGrading.material', v);
    }

    @property
    private _contribute = 1;
    @property
    get contribute() {
        return this._contribute;
    }
    set contribute(v: number) {
        this._contribute = v;
        this._proxy?.onPropertyChanged(this, 'colorGrading.contribute', v);
    }

    @property({ type: Texture2D })
    private _colorGradingMap = null;
    @property({ type: Texture2D })
    get colorGradingMap() {
        return this._colorGradingMap;
    }
    set colorGradingMap(v: Texture2D) {
        this._colorGradingMap = v;
        this._proxy?.onPropertyChanged(this, 'colorGrading.colorGradingMap', v);
    }
}

@ccclass('FSRSettings')
export class FSRSettings implements IFSRSettings, IPostEffectConfig {
    readonly willModifyScreenColor = true;
    readonly renderOrder = 1000;

    constructor(private _proxy: IPropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'fsr.enabled', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'fsr.material', v);
    }

    @property
    private _sharpness = 0.8;
    @property
    get sharpness() {
        return this._sharpness;
    }
    set sharpness(v: number) {
        this._sharpness = v;
        this._proxy?.onPropertyChanged(this, 'fsr.sharpness', v);
    }
}

@ccclass('FXAASettings')
export class FXAASettings implements IFXAASettings, IPostEffectConfig {
    readonly willModifyScreenColor = true;
    readonly renderOrder = 0;

    constructor(private _proxy: IPropertyNotifier) {
    }
    
    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'fxaa.enabled', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'fxaa.material', v);
    }
}

@ccclass('ToneMappingSettings')
export class ToneMappingSettings implements IToneMappingSettings, IPostEffectConfig {
    readonly willModifyScreenColor = false;
    readonly renderOrder = 100;

    constructor(private _proxy: IPropertyNotifier) {
    }

    @property({ type: Material, tooltip: 'Custom tone mapping material. If not set, uses built-in utilMtl.' })
    private _material: Material | null = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material | null) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'toneMapping.material', v);
    }
}

export enum SSSQuality {
    Low = 0,
    Medium = 1,
    High = 2
}
const SSSQualityEnum = Enum(SSSQuality);

@ccclass('SSSSettings')
export class SSSSettings implements ISSSSettings {
    constructor(private _proxy: IPropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'sss.enabled', v);
    }

    @property({ type: SSSQualityEnum })
    private _quality: SSSQuality = SSSQuality.High;
    @property({ type: SSSQualityEnum, tooltip: 'SSS blur quality' })
    get quality() {
        return this._quality;
    }
    set quality(v: SSSQuality) {
        this._quality = v;
        this._proxy?.onPropertyChanged(this, 'sss.quality', v);
    }

    @property({ type: Texture2D })
    private _lutTexture: Texture2D | null = null;
    @property({ type: Texture2D, tooltip: 'SSS LUT texture' })
    get lutTexture() {
        return this._lutTexture;
    }
    set lutTexture(v: Texture2D | null) {
        this._lutTexture = v;
        this._proxy?.onPropertyChanged(this, 'sss.lutTexture', v);
    }
}
