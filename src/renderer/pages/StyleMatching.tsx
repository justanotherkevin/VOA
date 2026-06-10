import React, { useState } from 'react';
import { Card, CardContent } from '@/renderer/components/card';
import { Toggle } from '@/renderer/components/toggle';
import { MessageCircle, Briefcase, Mail, CheckCircle } from 'lucide-react';

interface StyleOption {
	id: string;
	name: string;
	description: string;
	example: string;
	selected?: boolean;
}

interface MessageType {
	id: string;
	name: string;
	icon: React.ReactNode;
	description: string;
	appExamples: {
		icon: React.ReactNode;
		name: string;
	}[];
	styles: StyleOption[];
}

const STYLE_MATCHING_DATA: MessageType[] = [
	{
		id: 'casual',
		name: 'Casual Messages',
		icon: <MessageCircle className="w-5 h-5" />,
		description: 'This style applies in personal messengers',
		appExamples: [
			{ icon: '💚', name: '' },
			{ icon: '💙', name: '' },
			{ icon: '💚', name: '' },
		],
		styles: [
			{
				id: 'formal',
				name: 'Formal',
				description: 'Professional (default)',
				example:
					'Hey, are we still on for dinner? Thinking 7 works, unless you need to change it.',
				selected: true,
			},
			{
				id: 'casual',
				name: 'Casual',
				description: 'Less punctuation',
				example:
					'hey are we still on for dinner later? thinking 7 works unless u need to change it',
			},
			{
				id: 'extremely-casual',
				name: 'Extremely Casual',
				description: 'Less punctuation & no caps',
				example:
					'hey are we still on for dinner later? thinking 7 works unless u need to change it',
			},
		],
	},
	{
		id: 'work',
		name: 'Work Messages',
		icon: <Briefcase className="w-5 h-5" />,
		description: 'This style applies in professional communications',
		appExamples: [
			{ icon: '📧', name: '' },
			{ icon: '💼', name: '' },
			{ icon: '📱', name: '' },
		],
		styles: [
			{
				id: 'formal-work',
				name: 'Formal',
				description: 'Professional (default)',
				example:
					'Good morning, are we still on schedule for the meeting at 2 PM? Please confirm at your earliest convenience.',
				selected: true,
			},
			{
				id: 'casual-work',
				name: 'Casual',
				description: 'Less formal',
				example: 'Hey, just checking - are we still good for the 2 PM meeting?',
			},
			{
				id: 'extremely-casual-work',
				name: 'Extremely Casual',
				description: 'Very informal',
				example: 'yo still on for the 2pm?',
			},
		],
	},
	{
		id: 'email',
		name: 'Email',
		icon: <Mail className="w-5 h-5" />,
		description: 'This style applies in email communications',
		appExamples: [
			{ icon: '📧', name: '' },
			{ icon: '📬', name: '' },
			{ icon: '💌', name: '' },
		],
		styles: [
			{
				id: 'formal-email',
				name: 'Formal',
				description: 'Professional (default)',
				example:
					'Dear Team, I hope this email finds you well. I wanted to confirm our meeting time of 2 PM.',
				selected: true,
			},
			{
				id: 'casual-email',
				name: 'Casual',
				description: 'Less formal',
				example:
					'Hi all, just wanted to touch base about our 2 PM meeting today. Looking forward to it!',
			},
			{
				id: 'extremely-casual-email',
				name: 'Extremely Casual',
				description: 'Very informal',
				example: "hey team - don't forget about our 2pm! see ya then",
			},
		],
	},
];

export default function StyleMatching() {
	const [isEnabled, setIsEnabled] = useState(false);
	const [activeTab, setActiveTab] = useState('casual');
	const [selectedStyles, setSelectedStyles] = useState<Record<string, string>>({
		casual: 'formal',
		work: 'formal-work',
		email: 'formal-email',
	});

	const currentMessageType = STYLE_MATCHING_DATA.find(
		(mt) => mt.id === activeTab,
	);

	const handleStyleSelect = (messageTypeId: string, styleId: string) => {
		setSelectedStyles((prev) => ({
			...prev,
			[messageTypeId]: styleId,
		}));
	};

	return (
		<div className="w-full h-full overflow-auto">
			<div className="p-8 max-w-6xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900">Style Matching</h1>
					<p className="text-gray-600 mt-2">
						Willow learns from your writing style and preferences to improve
						your dictation experience. These insights help Willow adapt to your
						unique voice and communication patterns.
					</p>
				</div>

				{/* Enable Style Matching Toggle */}
				<Card className="border-0 mb-6">
					<CardContent className="p-8">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-xl font-semibold text-gray-900">
									Enable Style Matching
								</h2>
								<p className="text-gray-600 text-sm mt-1">
									Your edits make Willow smarter.
								</p>
							</div>
							{/* TODO: style matching based on where active window */}
							<Toggle
								checked={isEnabled}
								onCheckedChange={setIsEnabled}
								disabled
							/>
						</div>
					</CardContent>
				</Card>

				{/* Tabs */}
				<div className="mb-6 flex gap-3 flex-wrap">
					{STYLE_MATCHING_DATA.map((messageType) => (
						<button
							key={messageType.id}
							onClick={() => setActiveTab(messageType.id)}
							className={`px-6 py-2 rounded-full font-medium transition-colors ${
								activeTab === messageType.id
									? 'bg-blue-600 text-white'
									: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
							}`}
						>
							{messageType.name}
						</button>
					))}
				</div>

				{currentMessageType && (
					<>
						{/* Application Scope */}
						<Card className="border-0 mb-6">
							<CardContent className="p-6">
								<div className="flex items-start gap-4">
									<div className="flex gap-2">
										{currentMessageType.appExamples.map((app, idx) => (
											<span key={idx} className="text-2xl">
												{app.icon}
											</span>
										))}
									</div>
									<div className="flex-1">
										<h3 className="font-semibold text-gray-900">
											{currentMessageType.description}
										</h3>
										<p className="text-sm text-gray-600 mt-1">
											We'll use this information to match your writing style
											when you dictate.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Style Options */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							{currentMessageType.styles.map((style) => {
								const isSelected = selectedStyles[activeTab] === style.id;
								return (
									<button
										key={style.id}
										onClick={() => handleStyleSelect(activeTab, style.id)}
										className={`text-left transition-all ${
											isSelected ? 'ring-2 ring-blue-600' : 'hover:shadow-lg'
										}`}
									>
										<Card
											className={`border-0 h-full ${
												isSelected
													? 'shadow-lg border-2 border-blue-600'
													: 'shadow'
											}`}
										>
											<CardContent className="p-6">
												{/* Selection Indicator */}
												<div className="flex items-start justify-between mb-4">
													<div>
														<h3 className="font-semibold text-gray-900 text-lg">
															{style.name}
														</h3>
														<p className="text-sm text-gray-600">
															{style.description}
														</p>
													</div>
													{isSelected && (
														<CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
													)}
												</div>

												{/* Example Message */}
												<div className="mt-4 p-4 bg-blue-50 rounded-lg">
													<p className="text-sm text-blue-900 leading-relaxed">
														{style.example}
													</p>
												</div>
											</CardContent>
										</Card>
									</button>
								);
							})}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
