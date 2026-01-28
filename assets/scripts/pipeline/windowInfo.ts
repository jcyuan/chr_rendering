export class WindowInfo {
    protected _id = 0xFFFFFFFF;
    protected _width = 0;
    protected _height = 0;
    protected _nativeWidth = 0;
    protected _nativeHeight = 0;
    protected _shadingScale = 1;

    public set(id: number, nativeWidth: number, nativeHeight: number, shadingScale: number = 1) {
        this._id = id;
        this._nativeWidth = nativeWidth;
        this._nativeHeight = nativeHeight;
        this._shadingScale = shadingScale;
        this._width = Math.max(Math.floor(nativeWidth * shadingScale), 1);
        this._height = Math.max(Math.floor(nativeHeight * shadingScale), 1);
    }

    get id(): number {
        return this._id;
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get nativeWidth(): number {
        return this._nativeWidth;
    }

    get nativeHeight(): number {
        return this._nativeHeight;
    }

    get shadingScale(): number {
        return this._shadingScale;
    }
}
