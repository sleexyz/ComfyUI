{
  description = "comfyui";
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
          ];
        };
      in
      with pkgs;
      {
        devShell = mkShell {
          nativeBuildInputs = [
            python3Full
            jupyter
            entr
            graphviz
            bun
          ];
        };
      }
    );
}
