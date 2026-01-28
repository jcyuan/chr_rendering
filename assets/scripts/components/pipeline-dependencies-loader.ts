import { _decorator, builtinResMgr, Component, Material } from "cc";

const { ccclass, executeInEditMode, disallowMultiple, property } = _decorator;

@ccclass('PipelineDependenciesLoader')
@disallowMultiple
@executeInEditMode
export class PipelineDependenciesLoader extends Component {    
    @property({ type: Material, tooltip: 'The material used for utility passes like copy' })
    utilMaterial: Material = null;
    
    protected override __preload() {
        if (this.utilMaterial == null)
            throw new Error('utilMaterial is required, use materials/util.mtl');
        builtinResMgr.addAsset('utilMtl', this.utilMaterial);
        
        super.__preload?.();
    }

    protected onDestroy(): void {
        this.utilMaterial?.destroy();
    }
}
