import { Vec3 } from "cc";
import { Quat } from "cc";
import { _decorator } from "cc";
import { Component } from "cc";

const { ccclass, property } = _decorator;

@ccclass('RotateObject')
export class RotateObject extends Component {
    @property
    private _speedScale = 1;
    @property
    get speedScale() {
        return this._speedScale;
    }
    set speedScale(v: number) {
        this._speedScale = v;
    }
    
    private _n = 0;
    private _q = new Quat();

    public update(dt: number) {
        this._n += dt * this._speedScale;
        Quat.fromEuler(this._q, this._n * 2, this._n * 3, this._n);
        this.node.setRotation(this._q);
    }
}
