{
  description = "Dev shell for gerch (Bun runtime, Node for Playwright, NixOS-safe Chromium)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              nodejs
              playwright.browsers-chromium
            ];

            env = {
              PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright.browsers-chromium}";
              PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
            };
          };
        }
      );
    };
}
