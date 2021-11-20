assert(
	GameState.GetVersionDate and tonumber(GAMESTATE:GetVersionDate()) >= 20210420,
	"Please playing in latest NotITG!"
);
local debug,setmetatable,string,table = debug,setmetatable,string,table;
local gmatch = string.gmatch or string.gfind;

local _G = getfenv(0);
local _M = {};
local _LOADED = {};
local _PRELOAD = {};
local _LEVEL = 1;
local _CURRENT_DIR = __this:GetXMLDir();
local _META = {
	__index = function(t,k)
		local f = _M[k];
		if not f then
			local g = _G[k];
			f = type(g) == "table" and setmetatable({},{ __index = g }) or g;
		end
		return f;
	end,
	__newindex = _M,
};

for k,v in pairs(_G) do
	local f;
	if type(v) == "table" then
		f = setmetatable({},{ __index = v });
	else
		f = v;
	end
	_LOADED[k] = f;
end

local function getfield(t,f)
	for w in gmatch(f,"[%w_]+") do
		if not t[w] then
			return nil;
		end
		t = t[w];
	end
	return t;
end

local function setfield(t,f,v)
	for w,d in gmatch(f,"([%w_]+)(.?)") do
		if d == "." then
			t[w] = t[w] or {};
			t = t[w];
		else
			t[w] = v;
		end
	end
end

local function SplitPath(path)
	local t = {};
	for w in gmatch(path,"[^/]+") do
		table.insert(t,w);
	end
	return t;
end

local function GetRelativePath(from,to)
	local t1 = SplitPath(from);
	local t2 = SplitPath(to);
	local res = {};
	for i,v in ipairs(t2) do
		if v ~= t1[i] then
			table.insert(res,v);
		end
	end
	return table.concat(res,"/");
end

local function findname(name,level)
	local source = string.sub(debug.getinfo(level+1,"S").source,2);
	local dirname = string.sub(source,1,string.find(source,"/[^/]*$"));
	local path = GetRelativePath(_CURRENT_DIR,dirname);
	if path ~= "" then
		name = string.format("%s.%s",string.gsub(path,"/","%."),name);
	end
	return name;
end

local function exist(name,dir)
	local path = string.format("%s%s.lua",dir,string.gsub(name,"%.","/"));
	assert(
		GAMESTATE:GetFileStructure(path),
		string.format("error loading module \"%s\"",path)
	);
	return path;
end

local function checkerror(f)
	local status,err = pcall(f);
	if not status then
		error(debug.traceback(err));
	end
end

local function import(name)
	local f = rawget(_LOADED,name);
	if f then
		return f;
	end
	local name = findname(string.gsub(name,"/","%."),_LEVEL+1);
	local f = getfield(_PRELOAD,name);
	if f then
		return f;
	end
	local chunk,err = loadfile(exist(name,_CURRENT_DIR));
	assert(chunk,debug.traceback(err));
	local newgt = {
		_G = _G,
		_LOADED = _LOADED,
		_PRELOAD = _PRELOAD,
		import = import,
	};
	setmetatable(newgt,_META);
	setfenv(chunk,newgt);
	checkerror(chunk);
	local res = chunk();
	setfield(_PRELOAD,name,res);
	return res;
end

do
	local f = import "main";
	__this:addcommand("ScreenReady",f.Init);
	__this:SetUpdateFunction(f.Update);
	__this:SetDrawFunction(f.Draw);
	__this:sleep(1E9);
end

collectgarbage();
