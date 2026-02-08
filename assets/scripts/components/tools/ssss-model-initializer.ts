import { _decorator, Component, MeshRenderer, Vec4, warn } from 'cc';
import { EDITOR } from 'cc/env';
import { SSSSType, SSSSTypeEnum, sssUtils } from '../../pipeline/utils';

const { ccclass, property, executeInEditMode, requireComponent } = _decorator;

@ccclass('SSSSModelInitializer')
@requireComponent(MeshRenderer)
@executeInEditMode
export class SSSModelInitializer extends Component {
    @property
    private _profile = SSSSType.Skin;
    @property({ type: SSSSTypeEnum })
    get profile() {
        return this._profile;
    }
    set profile(value: SSSSType) {
        this._profile = value;
        this.updateProfile();
    }

    private _color = new Vec4();

    public getModelExtent() {
        const model = this.node.getComponent(MeshRenderer)?.model;
        if (!model) {
            warn('[SSSModelInitializer] model not found, ignored to calculate');
            return;
        }
        
        const worldBounds = model.worldBounds;
        if (!worldBounds) {
            console.warn(`[SSSModelInitializer] model has no worldBounds on node: ${this.node.name}`);
            return;
        }

        const extentLength = worldBounds.halfExtents.length() * 2;
        const range = 2.0;
        const scaledExtent = extentLength * range;
        
        if (EDITOR)
            console.info(`[SSSModelInitializer] node: ${this.node.name}, scaled extent: ${scaledExtent.toFixed(4)}`);

        return scaledExtent;
    }
    
    private updateMatProperties() {
        const material = this.node.getComponent(MeshRenderer)?.material;
        if (!material) {
            warn(`[SSSModelInitializer] Material not found, ignored to set value for node: ${this.node.name}`);
            return;
        }
        
        // 1, model extent
        material.setProperty('modelExtent', this.getModelExtent());

        // 2, update profile
        this.updateProfile();

        if (EDITOR)
            console.info(`[SSSModelInitializer] node: ${this.node.name} has been initialized`);
    }

    private updateProfile() {
        const material = this.node.getComponent(MeshRenderer)?.material;
        if (!material)
            return;
        Vec4.fromArray(this._color, sssUtils.getProfile(this._profile - 1).falloff);
        material.setProperty('scatteringProfile', this._profile);
        material.setProperty('translucencyColor', this._color);
    }

    protected override start(): void {
        this.updateMatProperties();
    }
}
