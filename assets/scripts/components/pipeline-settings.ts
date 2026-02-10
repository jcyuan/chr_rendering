import { _decorator, Camera, Component, rendering } from 'cc';
import { EDITOR } from 'cc/env';
import EventEmitter from 'eventemitter3';
import { BloomSettings, ColorGradingSettings, FSRSettings, FXAASettings, IPropertyNotifier, SSSSettings, ToneMappingSettings } from '../pipeline/pass-settings';
import { IPipelineSettings } from '../pipeline/xq-pipeline-types';
const { ccclass, property, executeInEditMode, disallowMultiple, requireComponent } = _decorator;

@ccclass('XQPipelineSettings')
@executeInEditMode
@disallowMultiple
@requireComponent(Camera)
export class XQPipelineSettings extends Component implements IPipelineSettings, IPropertyNotifier {
    private _event = new EventEmitter();

    private static _defaultSettings: XQPipelineSettings;
    static get defaultSettings(): XQPipelineSettings {
        if (!this._defaultSettings)
            this._defaultSettings = new XQPipelineSettings();
        return this._defaultSettings;
    }

    @property
    private _enableShadingScale = false;
    @property
    get enableShadingScale() {
        return this._enableShadingScale;
    }
    set enableShadingScale(v: boolean) {
        this._enableShadingScale = v;
        if (EDITOR)
            this._tryEnableEditorPreview();
    }

    @property({ min: 0.1, max: 1, slide: true, step: 0.1 })
    private _shadingScale = 0.7;
    @property
    get shadingScale(): number {
        return this._shadingScale;
    }
    set shadingScale(v: number) {
        this._shadingScale = v;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }

    @property({ type: FSRSettings })
    fsr = new FSRSettings(this);

    @property({ type: FXAASettings })
    fxaa = new FXAASettings(this);

    @property({ type: BloomSettings })
    bloom = new BloomSettings(this);

    @property({ type: ColorGradingSettings })
    colorGrading = new ColorGradingSettings(this);
    
    @property({ type: ToneMappingSettings })
    toneMapping = new ToneMappingSettings(this);

    @property({ type: SSSSettings })
    sss = new SSSSettings(this);
    
    onPropertyChanged(target: any, property: string, value: any): void {
        if (EDITOR) {
            console.log('onPropertyChanged', target, property, value);
            this._tryEnableEditorPreview();
        }
        this.emit('propertyChanged', property, value);
    }
    
    onEnable(): void {
        this.getComponent(Camera)!.camera.pipelineSettings = this;
        if (EDITOR)
            this._tryEnableEditorPreview();
    }

    onDisable(): void {
        this.getComponent(Camera)!.camera.pipelineSettings = null;
        if (EDITOR)
            this._disableEditorPreview();
    }
    
    @property
    private _editorPreview = false;

    @property
    get editorPreview(): boolean {
        return this._editorPreview;
    }
    set editorPreview(v: boolean) {
        this._editorPreview = v;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }

    private _tryEnableEditorPreview(): void {
        if (rendering === undefined)
            return;

        if (this._editorPreview)
            rendering.setEditorPipelineSettings(this);
        else
            this._disableEditorPreview();
    }

    private _disableEditorPreview(): void {
        if (rendering === undefined)
            return;
        
        const current = rendering.getEditorPipelineSettings() as XQPipelineSettings | null;
        if (current === this)
            rendering.setEditorPipelineSettings(null);
    }

    on(type: string, listener: (...args: unknown[]) => void, thisObject?: any): void {
        this._event.on(type, listener, thisObject);
    }

    emit(type: string, property: string, value: unknown): boolean {
        return this._event.emit(type, property, value);
    }
    
    off(type: string, listener: (property: string, value: unknown) => void, thisObject?: any): void {
        this._event.off(type, listener, thisObject);
    }

    hasListeners(type: string): boolean {
        return this._event.listenerCount(type) > 0;
    }

    once(type: string, listener: (property: string, value: unknown) => void, thisObject?: any): void {
        this._event.once(type, listener, thisObject);
    }
}
