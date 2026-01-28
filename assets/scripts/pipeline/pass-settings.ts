import { Enum, gfx, Material, Texture2D } from "cc";
import { _decorator } from "cc";

const { ccclass, property } = _decorator;

const SampleCountEnum = Enum(gfx.SampleCount);

export enum BloomType {
    KawaseDualFilter,
    MipmapFilter,
}
const BloomTypeEnum = Enum(BloomType);

export interface PropertyNotifier {
    onPropertyChanged(target: any, property: string, value: any): void;
}

@ccclass('MSAASettings')
export class MSAASettings implements MSAASettings {
    constructor(private _proxy: PropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'enabled', v);
    }

    @property({ type: SampleCountEnum })
    private _sampleCount = gfx.SampleCount.X4;
    @property({ type: SampleCountEnum })
    get sampleCount() {
        return this._sampleCount;
    }
    set sampleCount(v: gfx.SampleCount) {
        this._sampleCount = v;
        this._proxy?.onPropertyChanged(this, 'sampleCount', v);
    }
}

@ccclass('BloomSettings')
export class BloomSettings implements BloomSettings {
    constructor(private _proxy: PropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'enabled', v);
    }

    @property({ type: BloomTypeEnum })
    private _type = BloomType.KawaseDualFilter;
    @property({ type: BloomTypeEnum })
    get type() {
        return this._type;
    }
    set type(v: BloomType) {
        this._type = v;
        this._proxy?.onPropertyChanged(this, 'type', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'material', v);
    }

    @property({ type: Material })
    private _kawaseFilterMaterial = null;
    @property({ type: Material })
    get kawaseFilterMaterial() {
        return this._kawaseFilterMaterial;
    }
    set kawaseFilterMaterial(v: Material) {
        this._kawaseFilterMaterial = v;
        this._proxy?.onPropertyChanged(this, 'kawaseFilterMaterial', v);
    }

    @property({ type: Material })
    private _mipmapFilterMaterial = null;
    @property({ type: Material })
    get mipmapFilterMaterial() {
        return this._mipmapFilterMaterial;
    }
    set mipmapFilterMaterial(v: Material) {
        this._mipmapFilterMaterial = v;
        this._proxy?.onPropertyChanged(this, 'mipmapFilterMaterial', v);
    }

    @property
    private _enableAlphaMask = false;
    @property
    get enableAlphaMask() {
        return this._enableAlphaMask;
    }
    set enableAlphaMask(v: boolean) {
        this._enableAlphaMask = v;
        this._proxy?.onPropertyChanged(this, 'enableAlphaMask', v);
    }

    @property
    private _iterations = 3;
    @property
    get iterations() {
        return this._iterations;
    }
    set iterations(v: number) {
        this._iterations = v;
        this._proxy?.onPropertyChanged(this, 'iterations', v);
    }

    @property
    private _threshold = 0.8;
    @property
    get threshold() {
        return this._threshold;
    }
    set threshold(v: number) {
        this._threshold = v;
        this._proxy?.onPropertyChanged(this, 'threshold', v);
    }

    @property
    private _intensity = 1;
    @property
    get intensity() {
        return this._intensity;
    }
    set intensity(v: number) {
        this._intensity = v;
        this._proxy?.onPropertyChanged(this, 'intensity', v);
    }
}

@ccclass('ColorGradingSettings')
export class ColorGradingSettings implements ColorGradingSettings {
    constructor(private _proxy: PropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'enabled', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'material', v);
    }

    @property
    private _contribute = 1;
    @property
    get contribute() {
        return this._contribute;
    }
    set contribute(v: number) {
        this._contribute = v;
        this._proxy?.onPropertyChanged(this, 'contribute', v);
    }

    @property({ type: Texture2D })
    private _colorGradingMap = null;
    @property({ type: Texture2D })
    get colorGradingMap() {
        return this._colorGradingMap;
    }
    set colorGradingMap(v: Texture2D) {
        this._colorGradingMap = v;
        this._proxy?.onPropertyChanged(this, 'colorGradingMap', v);
    }
}

@ccclass('FSRSettings')
export class FSRSettings implements FSRSettings {
    constructor(private _proxy: PropertyNotifier) {
    }

    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'enabled', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'material', v);
    }

    @property
    private _sharpness = 0.8;
    @property
    get sharpness() {
        return this._sharpness;
    }
    set sharpness(v: number) {
        this._sharpness = v;
        this._proxy?.onPropertyChanged(this, 'sharpness', v);
    }
}

@ccclass('FXAASettings')
export class FXAASettings implements FXAASettings {
    constructor(private _proxy: PropertyNotifier) {
    }
    
    @property
    private _enabled = false;
    @property
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        this._proxy?.onPropertyChanged(this, 'enabled', v);
    }

    @property({ type: Material })
    private _material = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'material', v);
    }
}

@ccclass('ToneMappingSettings')
export class ToneMappingSettings implements ToneMappingSettings {
    constructor(private _proxy: PropertyNotifier) {
    }

    @property({ type: Material, tooltip: 'Custom tone mapping material. If not set, uses built-in utilMtl.' })
    private _material: Material | null = null;
    @property({ type: Material })
    get material() {
        return this._material;
    }
    set material(v: Material | null) {
        this._material = v;
        this._proxy?.onPropertyChanged(this, 'material', v);
    }
}
