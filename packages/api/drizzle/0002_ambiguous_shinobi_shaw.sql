CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`is_own_message` integer NOT NULL,
	`created_at` integer NOT NULL
);
