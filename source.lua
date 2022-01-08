local _G = getfenv( 0 );
local table, string, debug = _G.table, _G.string, _G.debug;
local assert, setmetatable, type = _G.assert, _G.setmetatable, _G.type;

local print = print or Trace;
local gmatch = string.gmatch or string.gfind;

-- Check NotITG Version
assert(
	GameState.GetVersionDate and tonumber(GAMESTATE:GetVersionDate()) >= 20210420,
	"Please playing in latest NotITG!"
);

local function getfield( t, f )
	for w in gmatch(f,"[%w_]+") do
		if not t[w] then
			return nil;
		end
		t = t[w];
	end
	return t;
end

local function setfield( t, f, v )
	for w,d in gmatch(f,"([%w_]+)(.?)") do
		if d == "." then
			t[w] = t[w] or {};
			t = t[w];
		else
			t[w] = v;
		end
	end
end

local function copy( orig )
	if type(orig) ~= "table" then
		return orig;
	end
	local res = {};
	for k,v in next,orig do
		rawset( res, k, v );
	end
	return res;
end

local function merge( t )
	for k,v in next,_G do
		if not t[k] then
			if type(v) == "function" then
				local info = debug.getinfo( v, "S" );
				if info.what == "C" then
					t[k] = v;
				end
			else
				t[k] = copy( v );
			end
		end
	end
end

local _LEVEL = 1;
local _CURRENT_DIR = __this:GetXMLDir();
local _ENV = {
	assert			= _G.assert,
	collectgarbage	= _G.collectgarbage,
	dofile			= _G.dofile,
	error			= _G.error,
	getmetatable	= _G.getmetatable,
	ipairs			= _G.ipairs,
	load			= _G.load,
	loadfile		= _G.loadfile,
	next			= _G.next,
	pairs			= _G.pairs,
	pcall			= _G.pcall,
	print			= _G.print,
	rawequal		= _G.rawequal,
	rawget			= _G.rawget,
	rawlen			= _G.rawlen,
	rawset			= _G.rawset,
	require			= _G.require,
	select			= _G.select,
	setmetatable	= _G.setmetatable,
	tonumber		= _G.tonumber,
	tostring		= _G.tostring,
	type			= _G.type,
	warn			= _G.warn,
	xpcall			= _G.xpcall,
};
local _LOADED = {
	base		= {},
	coroutine	= copy( _G.coroutine ),
	table		= copy( _G.table ),
	io			= copy( _G.io ),
	os			= copy( _G.os ),
	string		= copy( _G.string ),
	utf8		= copy( _G.utf8 ),
	math		= copy( _G.math ),
	debug		= copy( _G.debug ),
	package		= copy( _G.package ),
};
local _PRELOAD = {};
local _META = {
	__index = _ENV,
	__newindex = _ENV,
};

merge( _ENV );
merge( _LOADED["base"] );

local function SplitPath( path )
	local t = {};
	for w in gmatch(path,"[^/]+") do
		table.insert( t, w );
	end
	return t;
end

local function GetRelativePath( from, to )
	local t1 = SplitPath( from );
	local t2 = SplitPath( to );
	local res = {};
	for i,v in ipairs(t2) do
		if v ~= t1[i] then
			table.insert( res, v );
		end
	end
	return table.concat( res, "/" );
end

local function findname( name, level )
	local info = debug.getinfo( level+1, "S" );
	assert( info );
	local source = string.sub( info.source, 2 );
	local dirname = string.sub( source, 1, string.find(source,"/[^/]*$") );
	local path = GetRelativePath( _CURRENT_DIR, dirname );
	if path ~= "" then
		path = string.gsub( path, "/", "%." );
		name = string.format( "%s.%s", path, name );
	end
	return name;
end

local function exist( name, dir )
	local name = string.gsub( name, "%.", "/" );
	local path = string.format( "%s%s.lua", dir, name );
	assert( GAMESTATE:GetFileStructure(path), string.format("error loading module \"%s\"",path) );
	return path;
end

local function import( name )
	name = string.gsub( name, "/", "%." );
	-- _LOADED
	local f = rawget( _LOADED, name );
	if f then
		return f;
	end
	name = findname( name, _LEVEL+1 );
	-- _PRELOAD
	local f = getfield( _PRELOAD, name );
	if f then
		return f;
	end
	-- Load Module
	local path = exist( name, _CURRENT_DIR );
	local chunk, err = loadfile( path );
	assert( chunk, debug.traceback(err) );
	local newgt = {
		_G			= _ENV,
		_LOADED		= _LOADED,
		_PRELOAD	= _PRELOAD,
		_VERSION	= __VERSION__,
		import		= import,
	};
	setmetatable( newgt, _META );
	setfenv( chunk, newgt );
	-- Save Chunk
	local res = chunk();
	setfield( _PRELOAD, name, res );
	return res;
end

local f = import "main";
if f then
	__this:addcommand( "ScreenReady", f.Init );
	__this:SetUpdateFunction( f.Update );
	__this:SetDrawFunction( f.Draw );
	__this:sleep( 1E9 );
end

collectgarbage();
