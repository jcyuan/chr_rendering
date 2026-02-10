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

    private updateProfile() {
        const material = this.node.getComponent(MeshRenderer)?.material;
        if (!material) {
            warn(`[SSSModelInitializer] Material not found on node: ${this.node.name}`);
            return;
        }
        Vec4.fromArray(this._color, sssUtils.getProfile(this._profile - 1).falloff);
        material.setProperty('scatteringProfile', this._profile);
        material.setProperty('translucencyColor', this._color);
    }

    protected override start(): void {
        this.updateProfile();
    }
}
