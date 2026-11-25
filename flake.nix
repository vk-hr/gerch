{
  description = "gerch dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      # Keep in sync with the exact `bun` devDependency in package.json.
      # test/toolchain.test.ts fails if these drift from bun.lock.
      bunVersion = "1.4.5-canary.20261124.1";
      bunTarballs = {
        x86_64-linux = {
          pkg = "bun-linux-x64";
          hash = "sha512-bPgrPTNQtJp8oLQBaak99SCQEob5vZ33SlkbzFkzR0M4l7XWpqYiLTM4BqFs1gMJDgkU3DyQPbQRYxUxdUWCTw==";
        };
        aarch64-linux = {
          pkg = "bun-linux-aarch64";
          hash = "sha512-/z+WzPRwCOCwzDRIiw1KAWUaietm+QKqGcV04ZERo8HEhYJqNB13ub1hNanaA1P//y323vY5C95pGt9SltMgtw==";
        };
        aarch64-darwin = {
          pkg = "bun-darwin-aarch64";
          hash = "sha512-akutH6TzdaE0eIVXZcH1+PaxZtC/a7yhlf13H+CwmdU6QrwmNC/CIscoh10OPrWImKWTrk5CKUazwCySgEc7VA==";
        };
      };
      forSystems = f: nixpkgs.lib.genAttrs (builtins.attrNames bunTarballs) (system: f system nixpkgs.legacyPackages.${system});
    in
    {
      packages = forSystems (system: pkgs: {
        bun = pkgs.stdenv.mkDerivation {
          pname = "bun";
          version = bunVersion;
          src = pkgs.fetchurl {
            url = "https://registry.npmjs.org/@oven/${bunTarballs.${system}.pkg}/-/${bunTarballs.${system}.pkg}-${bunVersion}.tgz";
            inherit (bunTarballs.${system}) hash;
          };
          nativeBuildInputs = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [ pkgs.autoPatchelfHook ];
          buildInputs = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [ pkgs.stdenv.cc.cc.lib ];
          dontConfigure = true;
          dontBuild = true;
          dontStrip = true;
          installPhase = ''
            install -Dm755 bin/bun $out/bin/bun
            ln -s $out/bin/bun $out/bin/bunx
          '';
        };
      });

      devShells = forSystems (system: pkgs: {
        default = pkgs.mkShell {
          packages = [
            self.packages.${system}.bun
            pkgs.hk
            pkgs.pkl
          ];
          # Browsers for @playwright/test, matching its pinned version.
          PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        };
      });
    };
}
