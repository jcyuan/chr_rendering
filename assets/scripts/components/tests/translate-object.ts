import { _decorator, Component, director, Vec3 } from "cc";

const { ccclass, property } = _decorator;

@ccclass('TranslateObject')
export class TranslateObject extends Component {
    @property
    private _speedScale = 1;
    @property
    get speedScale() {
        return this._speedScale;
    }
    set speedScale(v: number) {
        this._speedScale = v;
    }

    @property
    private _range = 0.5;
    @property
    get range() {
        return this._range;
    }
    set range(v: number) {
        this._range = v;
    }

    @property
    private _period = 8;
    @property
    get period() {
        return this._period;
    }
    set period(v: number) {
        this._period = v;
    }

    private _t = 0;

    public update(dt: number) {
        this._t += dt * this._speedScale;
        const x = Math.sin((2 * Math.PI * this._t) / this._period) * this._range;
        const pos = this.node.position;
        this.node.setPosition(x, pos.y, pos.z);
    }
}
