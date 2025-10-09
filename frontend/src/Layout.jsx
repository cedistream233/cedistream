import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Music, Video, ShoppingCart, Library, Settings, LogOut, User as UserIcon, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import LogoutConfirmModal from "@/components/ui/LogoutConfirmModal";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children, currentPageName }) {
	const location = useLocation();
	const navigate = useNavigate();
	const { user, logout, isAuthenticated, isCreator } = useAuth();
	const [showLogoutModal, setShowLogoutModal] = useState(false);
	const [cartCount, setCartCount] = useState(0); // TODO: Implement cart functionality

	const handleLogoutClick = () => {
		setShowLogoutModal(true);
	};

	const handleLogoutConfirm = async () => {
		logout();
		setShowLogoutModal(false);
		navigate('/');
	};

	const navItems = [
		{ name: "Home", url: createPageUrl("Home"), icon: Home },
		{ name: "Albums", url: createPageUrl("Albums"), icon: Music },
		{ name: "Videos", url: createPageUrl("Videos"), icon: Video },
		...(isAuthenticated ? [{ name: "My Library", url: createPageUrl("Library"), icon: Library }] : []),
	];

	const getUserDisplayName = () => {
		if (!user) return '';
		return user.firstName && user.lastName 
			? `${user.firstName} ${user.lastName}`
			: user.email;
	};

	const getUserInitials = () => {
		if (!user) return 'U';
		if (user.firstName && user.lastName) {
			return `${user.firstName[0]}${user.lastName[0]}`;
		}
		return user.email[0].toUpperCase();
	};

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
								CediStream
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
							{isAuthenticated && (
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
							)}

							{isAuthenticated ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" className="text-gray-300 hover:text-white">
											<div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
												{getUserInitials()}
											</div>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="bg-slate-900 border-purple-900/20 min-w-[200px]">
										<div className="px-3 py-2 border-b border-slate-700">
											<p className="text-sm font-medium text-white">{getUserDisplayName()}</p>
											<p className="text-xs text-gray-400">{user.email}</p>
											<p className="text-xs text-purple-400 capitalize">{user.role}</p>
										</div>
										
										{isCreator && (
											<>
												<DropdownMenuItem asChild>
													<Link to="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
														<BarChart3 className="w-4 h-4" />
														Creator Dashboard
													</Link>
												</DropdownMenuItem>
												<DropdownMenuSeparator className="bg-slate-700" />
											</>
										)}
										
										<DropdownMenuItem asChild>
											<Link to="/profile" className="flex items-center gap-2 text-gray-300 hover:text-white">
												<UserIcon className="w-4 h-4" />
												Profile Settings
											</Link>
										</DropdownMenuItem>
										
										<DropdownMenuSeparator className="bg-slate-700" />
										
										<DropdownMenuItem 
											onClick={handleLogoutClick} 
											className="flex items-center gap-2 text-red-400 hover:text-red-300 focus:text-red-300"
										>
											<LogOut className="w-4 h-4" />
											Sign Out
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<div className="flex items-center gap-2">
									<Button 
										variant="ghost" 
										asChild
										className="text-gray-300 hover:text-white"
									>
										<Link to="/login">Sign In</Link>
									</Button>
									<Button 
										asChild
										className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
									>
										<Link to="/signup">Sign Up</Link>
									</Button>
								</div>
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

			{/* Logout Confirmation Modal */}
			<LogoutConfirmModal
				isOpen={showLogoutModal}
				onClose={() => setShowLogoutModal(false)}
				onConfirm={handleLogoutConfirm}
				userName={getUserDisplayName()}
			/>
		</div>
	);
}
