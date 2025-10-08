import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Music, Video, ShoppingCart, Library, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { User } from "@/entities/User";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children, currentPageName }) {
	const location = useLocation();
	const [user, setUser] = React.useState(null);
	const [cartCount, setCartCount] = React.useState(0);

	React.useEffect(() => {
		loadUser();
	}, []);

	const loadUser = async () => {
		try {
			const userData = await User.me();
			setUser(userData);
			setCartCount(userData.cart?.length || 0);
		} catch (error) {
			// User not logged in
		}
	};

	const handleLogout = async () => {
		await User.logout();
		window.location.reload();
	};

	const navItems = [
		{ name: "Home", url: createPageUrl("Home"), icon: Home },
		{ name: "Albums", url: createPageUrl("Albums"), icon: Music },
		{ name: "Videos", url: createPageUrl("Videos"), icon: Video },
		{ name: "My Library", url: createPageUrl("Library"), icon: Library },
	];

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
			<style>{`
				:root {
					--primary: 270 70% 50%;
					--gold: 45 100% 60%;
				}
			`}</style>

			{/* Header */}
			<header className="sticky top-0 z-50 backdrop-blur-lg bg-slate-950/80 border-b border-purple-900/20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<Link to={createPageUrl("Home")} className="flex items-center gap-2">
							<div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
								<Music className="w-6 h-6 text-white" />
							</div>
							<span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
								ContentHub
							</span>
						</Link>

						<nav className="hidden md:flex items-center gap-1">
							{navItems.map((item) => (
								<Link
									key={item.name}
									to={item.url}
									className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
										location.pathname === item.url
											? "bg-purple-600 text-white"
											: "text-gray-300 hover:text-white hover:bg-purple-900/30"
									}`}
								>
									<item.icon className="w-4 h-4" />
									{item.name}
								</Link>
							))}
						</nav>

						<div className="flex items-center gap-3">
							<Link to={createPageUrl("Cart")}>
								<Button variant="ghost" size="icon" className="relative text-gray-300 hover:text-white">
									<ShoppingCart className="w-5 h-5" />
									{cartCount > 0 && (
										<span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-xs flex items-center justify-center text-white">
											{cartCount}
										</span>
									)}
								</Button>
							</Link>

							{user ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" className="text-gray-300 hover:text-white">
											<div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
												{user.full_name?.[0] || "U"}
											</div>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="bg-slate-900 border-purple-900/20">
										<DropdownMenuItem className="text-gray-300">
											{user.email}
										</DropdownMenuItem>
										{user.role === "admin" && (
											<DropdownMenuItem asChild>
												<Link to={createPageUrl("Admin")} className="flex items-center gap-2">
													<Settings className="w-4 h-4" />
													Admin Panel
												</Link>
											</DropdownMenuItem>
										)}
										<DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-gray-300">
											<LogOut className="w-4 h-4" />
											Logout
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<Button onClick={() => User.login()} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
									Sign In
								</Button>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Mobile Navigation */}
			<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t border-purple-900/20">
				<div className="flex justify-around items-center h-16 px-4">
					{navItems.map((item) => (
						<Link
							key={item.name}
							to={item.url}
							className={`flex flex-col items-center gap-1 ${
								location.pathname === item.url ? "text-purple-400" : "text-gray-400"
							}`}
						>
							<item.icon className="w-5 h-5" />
							<span className="text-xs">{item.name}</span>
						</Link>
					))}
				</div>
			</nav>

			{/* Main Content */}
			<main className="pb-20 md:pb-8">
				{children}
			</main>
		</div>
	);
}
