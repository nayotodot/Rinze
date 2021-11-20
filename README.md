# Rinze

It's will be able to read Lua files with XML for NotITG.

## How to Use

### Install

Install node packages in this repository.

```bash
npm install
```

Then enter your foreground directory.

```bash
npm start <path-to-foreground-directory>
```

### Coding

Write the following code in `main.lua`.

```lua
local t = {};

-- "ScreenReadyCommand"
function t.Init(self)
end

-- "SetUpdateFunction"
function t.Update(self,delta)
end

-- "SetDrawFunction"
function t.Draw(self)
end

return t;
```
