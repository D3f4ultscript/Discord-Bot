const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const express = require("express");
require('dotenv').config();

// ==== START: Webserver für UptimeRobot ====
const app = express();
const PORT = process.env.PORT || 3001; // Using different port than TicketBot

app.get("/", (req, res) => {
  res.send("D3f Bot is running!");
});

app.listen(PORT, () => {
  console.log('\n=== UPTIME ROBOT SETUP ===');
  console.log('Add this URL to UptimeRobot:');
  console.log(`🔗 https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
  console.log('========================\n');
});
// ==== END: Webserver für UptimeRobot ====

// Create bot with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

// Command usage statistics
let commandUsageCount = 0;

// Permission config
const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
const allowedUserId = '972533051173240875';

// Track users waiting to input rules messages
const waitingForRulesMessage = new Map();

// Check if a user has permission to use restricted commands
function hasPermission(member) {
    // Check if the user has the specific ID
    if (member.user.id === allowedUserId) {
        return true;
    }
    
    // Check if the user has any of the required roles
    return member.roles.cache.some(role => allowedRoleIds.includes(role.id));
}

// Überprüfe ob Token und Client ID vorhanden sind
if (!token || !clientId) {
    console.error('❌ Fehler: DISCORD_TOKEN oder CLIENT_ID fehlt in den Umgebungsvariablen!');
    process.exit(1);
}

// Define Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('chatclear')
        .setDescription('Deletes all messages in the channel (requires special role)'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands and their descriptions'),
    new SlashCommandBuilder()
        .setName('createrole')
        .setDescription('Creates a role with predefined permissions (requires special role)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of role to create')
                .setRequired(true)
                .addChoices(
                    { name: '👑 Owner', value: 'owner' },
                    { name: '⚡ Admin', value: 'admin' },
                    { name: '🛡️ Moderator', value: 'moderator' },
                    { name: '🎮 VIP', value: 'vip' },
                    { name: '👤 Member', value: 'member' }
                ))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Custom name for the role (optional)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('Gives a role to a member or everyone (requires special role)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to give')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to give the role to (leave empty for @everyone)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('everyone')
                .setDescription('Give the role to everyone on the server')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Removes a role from a member or everyone (requires special role)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to remove the role from (leave empty for @everyone)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('everyone')
                .setDescription('Remove the role from everyone on the server')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('infostats')
        .setDescription('Shows statistics about the bot'),
    new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Sets up a rules message with verification buttons (requires special role)')
        .addRoleOption(option =>
            option.setName('verification_role')
                .setDescription('The role to give when users accept the rules')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('showmembers')
        .setDescription('Shows all members, bots, and member count without bots')
];

// Event when bot is ready
client.once('ready', async () => {
    console.log(`Bot is online as ${client.user.tag}!`);
    
    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('Starte Registrierung der Slash Commands...');
        
        // Registriere die Commands global
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ Erfolgreich ${data.length} Slash Commands registriert!`);
        console.log('Registrierte Commands:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('Fehler beim Registrieren der Commands:', error);
        // Zeige mehr Details über den Fehler
        if (error.requestBody) {
            console.error('Request Details:', {
                body: error.requestBody,
                code: error.code,
                status: error.status,
                method: error.method
            });
        }
    }
});

// Event for Slash Commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Increment command usage counter
    commandUsageCount++;

    if (interaction.commandName === 'chatclear') {
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }
        
        // Create confirmation buttons
        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_clear')
            .setLabel('Yes, Clear Channel')
            .setStyle(ButtonStyle.Danger);
            
        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_clear')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);
            
        const row = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);
            
        await interaction.reply({
            content: '⚠️ Are you sure you want to delete ALL messages in this channel?',
            components: [row],
            ephemeral: true
        });
    }

    if (interaction.commandName === 'help') {
        const helpEmbed = {
            color: 0x0099FF,
            title: '📚 Available Commands',
            description: 'Here are all available commands:\n🔒 = Requires special role',
            fields: [
                {
                    name: '/help',
                    value: 'Shows this help message with all available commands',
                },
                {
                    name: '/showmembers',
                    value: 'Shows all members, bots, and member count statistics',
                },
                {
                    name: '/infostats',
                    value: 'Shows statistics about the bot',
                },
                {
                    name: '🔒 /chatclear',
                    value: 'Deletes all messages in the channel',
                },
                {
                    name: '🔒 /createrole',
                    value: 'Creates a role with predefined permissions',
                },
                {
                    name: '🔒 /giverole',
                    value: 'Gives a role to a member or everyone',
                },
                {
                    name: '🔒 /removerole',
                    value: 'Removes a role from a member or everyone',
                },
                {
                    name: '🔒 /rules',
                    value: 'Sets up a rules message with verification buttons',
                }
            ],
            timestamp: new Date(),
        };

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (interaction.commandName === 'createrole') {
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles to create roles.', ephemeral: true });
            return;
        }

        const roleType = interaction.options.getString('type');
        const customName = interaction.options.getString('name');

        // Define permission presets
        const rolePresets = {
            owner: {
                name: customName || '👑 Owner',
                color: '#FF0000',
                permissions: [
                    'Administrator'
                ],
                reason: 'Created owner role via command'
            },
            admin: {
                name: customName || '⚡ Admin',
                color: '#FFA500',
                permissions: [
                    'Administrator'
                ],
                reason: 'Created admin role via command'
            },
            moderator: {
                name: customName || '🛡️ Moderator',
                color: '#00FF00',
                permissions: [
                    'ViewAuditLog',
                    'ModerateMembers',
                    'KickMembers',
                    'ManageMessages',
                    'ManageThreads',
                    'ManageNicknames',
                    'MuteMembers',
                    'DeafenMembers',
                    'MoveMembers',
                    'ViewChannel',
                    'SendMessages',
                    'SendMessagesInThreads',
                    'CreatePublicThreads',
                    'CreatePrivateThreads',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'UseExternalStickers',
                    'MentionEveryone',
                    'ReadMessageHistory',
                    'UseApplicationCommands',
                    'Connect',
                    'Speak',
                    'Stream',
                    'UseVAD',
                    'PrioritySpeaker',
                    'RequestToSpeak'
                ],
                reason: 'Created moderator role via command'
            },
            vip: {
                name: customName || '🎮 VIP',
                color: '#FF69B4',
                permissions: [
                    'ViewChannel',
                    'SendMessages',
                    'SendMessagesInThreads',
                    'CreatePublicThreads',
                    'CreatePrivateThreads',
                    'SendVoiceMessages',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'UseExternalStickers',
                    'ReadMessageHistory',
                    'UseApplicationCommands',
                    'Connect',
                    'Speak',
                    'Stream',
                    'UseVAD',
                    'PrioritySpeaker',
                    'RequestToSpeak',
                    'UseSoundboard',
                    'UseEmbeddedActivities',
                    'ChangeNickname',
                    'CreateInstantInvite',
                    'UseExternalSounds'
                ],
                reason: 'Created VIP role via command'
            },
            member: {
                name: customName || '👤 Member',
                color: '#808080',
                permissions: [
                    'ViewChannel',
                    'SendMessages',
                    'SendMessagesInThreads',
                    'CreatePublicThreads',
                    'CreatePrivateThreads',
                    'SendVoiceMessages',
                    'EmbedLinks',
                    'AttachFiles',
                    'AddReactions',
                    'UseExternalEmojis',
                    'UseExternalStickers',
                    'ReadMessageHistory',
                    'UseApplicationCommands',
                    'Connect',
                    'Speak',
                    'Stream',
                    'UseVAD',
                    'UseSoundboard',
                    'UseEmbeddedActivities',
                    'RequestToSpeak',
                    'CreateInstantInvite'
                ],
                reason: 'Created member role via command'
            }
        };

        try {
            const roleSettings = rolePresets[roleType];
            const newRole = await interaction.guild.roles.create({
                name: roleSettings.name,
                color: roleSettings.color,
                permissions: roleSettings.permissions,
                reason: roleSettings.reason
            });

            const roleEmbed = {
                color: roleSettings.color,
                title: '✅ Role Created Successfully',
                description: `New role ${newRole} has been created!`,
                fields: [
                    {
                        name: 'Role Type',
                        value: roleType.charAt(0).toUpperCase() + roleType.slice(1),
                        inline: true
                    },
                    {
                        name: 'Role Name',
                        value: roleSettings.name,
                        inline: true
                    }
                ],
                timestamp: new Date()
            };

            await interaction.reply({ embeds: [roleEmbed], ephemeral: true });
        } catch (error) {
            console.error('Error creating role:', error);
            await interaction.reply({ 
                content: '❌ Failed to create role! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.commandName === 'giverole') {
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }

        const role = interaction.options.getRole('role');
        const member = interaction.options.getMember('member');
        const giveToEveryone = interaction.options.getBoolean('everyone');

        // Check if role exists
        if (!role) {
            await interaction.reply({ content: '❌ Role not found!', ephemeral: true });
            return;
        }

        try {
            // Check if we're giving the role to everyone
            if (giveToEveryone) {
                await interaction.reply({ 
                    content: `⏳ Starting to give the role ${role} to all members. This might take a while...`, 
                    ephemeral: true 
                });
                
                // Fetch all guild members and add the role to each
                const allMembers = await interaction.guild.members.fetch();
                let successCount = 0;
                let failCount = 0;
                
                for (const [id, guildMember] of allMembers) {
                    try {
                        await guildMember.roles.add(role);
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to add role to member ${guildMember.user.tag}:`, err);
                        failCount++;
                    }
                }
                
                await interaction.followUp({ 
                    content: `✅ Operation completed! Added role ${role} to ${successCount} members (failed: ${failCount}).`, 
                    ephemeral: true 
                });
            } else if (member) {
                // Add role to specified member
                await member.roles.add(role);
                
                // Send success message
                await interaction.reply({ 
                    content: `✅ The role ${role} has been successfully given to ${member}!`, 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: '❌ Please specify a member or enable the "everyone" option!', 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error('Error giving role:', error);
            await interaction.reply({ 
                content: '❌ Failed to give role! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.commandName === 'removerole') {
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }

        const role = interaction.options.getRole('role');
        const member = interaction.options.getMember('member');
        const removeFromEveryone = interaction.options.getBoolean('everyone');

        // Check if role exists
        if (!role) {
            await interaction.reply({ content: '❌ Role not found!', ephemeral: true });
            return;
        }

        try {
            // Check if we're removing the role from everyone
            if (removeFromEveryone) {
                await interaction.reply({ 
                    content: `⏳ Starting to remove the role ${role} from all members. This might take a while...`, 
                    ephemeral: true 
                });
                
                // Fetch all guild members who have the role and remove it
                const allMembers = await interaction.guild.members.fetch();
                let successCount = 0;
                let failCount = 0;
                
                for (const [id, guildMember] of allMembers) {
                    // Only try to remove the role if the member has it
                    if (guildMember.roles.cache.has(role.id)) {
                        try {
                            await guildMember.roles.remove(role);
                            successCount++;
                        } catch (err) {
                            console.error(`Failed to remove role from member ${guildMember.user.tag}:`, err);
                            failCount++;
                        }
                    }
                }
                
                await interaction.followUp({ 
                    content: `✅ Operation completed! Removed role ${role} from ${successCount} members (failed: ${failCount}).`, 
                    ephemeral: true 
                });
            } else if (member) {
                // Remove role from specified member
                await member.roles.remove(role);
                
                // Send success message
                await interaction.reply({ 
                    content: `✅ The role ${role} has been successfully removed from ${member}!`, 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: '❌ Please specify a member or enable the "everyone" option!', 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error('Error removing role:', error);
            await interaction.reply({ 
                content: '❌ Failed to remove role! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.commandName === 'infostats') {
        // Count how many servers the bot is in
        const serverCount = client.guilds.cache.size;
        
        // Create an embed with bot statistics
        const statsEmbed = {
            color: 0x00FFFF,
            title: '📊 Bot Statistics',
            thumbnail: {
                url: client.user.displayAvatarURL({ dynamic: true })
            },
            fields: [
                {
                    name: '🌐 Servers',
                    value: `${serverCount}`,
                    inline: true
                },
                {
                    name: '⌨️ Commands Used',
                    value: `${commandUsageCount}`,
                    inline: true
                },
                {
                    name: '⏱️ Uptime',
                    value: formatUptime(client.uptime),
                    inline: true
                }
            ],
            footer: {
                text: `Bot ID: ${client.user.id}`
            },
            timestamp: new Date()
        };
        
        await interaction.reply({ embeds: [statsEmbed] });
    }

    if (interaction.commandName === 'rules') {
        if (!hasPermission(interaction.member)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles.', ephemeral: true });
            return;
        }

        // Get the verification role
        const verificationRole = interaction.options.getRole('verification_role');
        
        // Store the user and role in the waiting map
        waitingForRulesMessage.set(interaction.user.id, {
            channelId: interaction.channelId,
            roleId: verificationRole.id,
            timestamp: Date.now() // To potentially expire old requests
        });
        
        // Ask the user to provide the rules message
        await interaction.reply({ 
            content: `Please type your rules message now. Your next message in this channel will be used as the rules content with verification buttons.`,
            ephemeral: true 
        });
    }

    if (interaction.commandName === 'showmembers') {
        try {
            // Fetch all members to ensure we have the latest data
            await interaction.guild.members.fetch();
            
            // Get all members
            const allMembers = interaction.guild.members.cache;
            
            // Calculate counts
            const totalMembers = allMembers.size;
            const bots = allMembers.filter(member => member.user.bot).size;
            const realMembers = totalMembers - bots;
            
            // Create lists of members and bots
            const memberList = allMembers
                .filter(member => !member.user.bot)
                .map(member => `${member.user.tag}`)
                .sort()
                .join('\n');
            
            const botList = allMembers
                .filter(member => member.user.bot)
                .map(member => `${member.user.tag}`)
                .sort()
                .join('\n');
            
            // Create embed
            const membersEmbed = {
                color: 0x0099FF,
                title: '📊 Server Member Statistics',
                fields: [
                    {
                        name: '📈 Overview',
                        value: [
                            `👥 Total Members: ${totalMembers}`,
                            `👤 Human Members: ${realMembers}`,
                            `🤖 Bots: ${bots}`
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '👤 Members List',
                        value: memberList || 'No members found',
                        inline: false
                    },
                    {
                        name: '🤖 Bots List',
                        value: botList || 'No bots found',
                        inline: false
                    }
                ],
                timestamp: new Date(),
                footer: {
                    text: `Server: ${interaction.guild.name}`
                }
            };
            
            await interaction.reply({ embeds: [membersEmbed] });
        } catch (error) {
            console.error('Error in showmembers command:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while fetching member information.', 
                ephemeral: true 
            });
        }
    }
});

// Event for Button Interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'confirm_clear') {
            if (!hasPermission(interaction.member)) {
                await interaction.update({ content: '❌ No permission! You need specific roles to clear the chat.', components: [] });
                return;
            }
            
            try {
                await interaction.update({ content: '🔄 Clearing channel...', components: [] });
                
                // Delete all messages
                let deleted;
                do {
                    deleted = await interaction.channel.bulkDelete(100, true);
                } while (deleted.size > 0);
                
                await interaction.followUp({ content: '✅ Channel has been successfully cleared!', ephemeral: true });
            } catch (error) {
                console.error('Error while deleting:', error);
                await interaction.followUp({ content: '❌ Error while deleting messages!', ephemeral: true });
            }
        }
        
        if (interaction.customId === 'cancel_clear') {
            await interaction.update({ content: 'Channel clearing cancelled.', components: [] });
        }

        // Handle rule acceptance
        if (interaction.customId.startsWith('accept_rules:')) {
            try {
                // Extract the role ID from the button custom ID
                const roleId = interaction.customId.split(':')[1];
                
                // Get the verification role
                const verificationRole = interaction.guild.roles.cache.get(roleId);
                
                if (!verificationRole) {
                    await interaction.reply({ content: '❌ Verification role not found! It may have been deleted.', ephemeral: true });
                    return;
                }
                
                // Add the role to the user
                await interaction.member.roles.add(verificationRole);
                
                // Send confirmation in the channel
                await interaction.reply({ content: `✅ You have been verified with the ${verificationRole.name} role! Thank you for accepting the rules.`, ephemeral: true });
                
                // Send DM to the user
                try {
                    await interaction.user.send({
                        content: `✅ **Verification Successful!**\n\nYou are now verified in **${interaction.guild.name}** with the ${verificationRole.name} role.\n\nBy accepting the rules, you agree to follow them at all times. Failure to comply may result in warnings or other penalties.\n\nIf you change your mind, you can use the decline button to remove your verification.`
                    });
                } catch (dmError) {
                    console.error('Could not send DM to user:', dmError);
                    // If we can't DM the user, we'll just continue without error
                }
            } catch (error) {
                console.error('Error during verification:', error);
                await interaction.reply({ content: '❌ Failed to verify you! Please contact an administrator.', ephemeral: true });
            }
        }
        
        // Handle rule declination
        if (interaction.customId.startsWith('decline_rules:')) {
            try {
                // Extract the role ID from the button custom ID
                const roleId = interaction.customId.split(':')[1];
                
                // Get the verification role
                const verificationRole = interaction.guild.roles.cache.get(roleId);
                
                if (verificationRole) {
                    // Remove the role from the user if they have it
                    if (interaction.member.roles.cache.has(verificationRole.id)) {
                        await interaction.member.roles.remove(verificationRole);
                    }
                }
                
                // Send confirmation
                await interaction.reply({ content: '❌ You have declined the rules. Some features may be restricted.', ephemeral: true });
                
                // Send DM to the user
                try {
                    await interaction.user.send({
                        content: `❌ **Rules Declined**\n\nYou have declined the rules in **${interaction.guild.name}**.\n\nSome features and channels may be restricted. If you change your mind, you can verify again by accepting the rules.`
                    });
                } catch (dmError) {
                    console.error('Could not send DM to user:', dmError);
                    // If we can't DM the user, we'll just continue without error
                }
            } catch (error) {
                console.error('Error during rule declination:', error);
                await interaction.reply({ content: '❌ An error occurred! Please contact an administrator.', ephemeral: true });
            }
        }
    }
});

// Message event handler for capturing rules content
client.on('messageCreate', async message => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if this user is waiting to input rules
    const waitingData = waitingForRulesMessage.get(message.author.id);
    if (waitingData && waitingData.channelId === message.channelId) {
        // Remove from waiting list
        waitingForRulesMessage.delete(message.author.id);
        
        // Create verification buttons
        const acceptButtonId = `accept_rules:${waitingData.roleId}`;
        const declineButtonId = `decline_rules:${waitingData.roleId}`;
        
        const acceptButton = new ButtonBuilder()
            .setCustomId(acceptButtonId)
            .setLabel('✅ Accept Rules / Verify')
            .setStyle(ButtonStyle.Success);
            
        const declineButton = new ButtonBuilder()
            .setCustomId(declineButtonId)
            .setLabel('❌ Decline Rules')
            .setStyle(ButtonStyle.Danger);
            
        const row = new ActionRowBuilder()
            .addComponents(acceptButton, declineButton);
            
        try {
            // Delete the user's message if we can
            try {
                await message.delete();
            } catch (deleteError) {
                console.error('Could not delete user message:', deleteError);
                // Continue even if we can't delete the message
            }
            
            // Send the rules message with buttons
            await message.channel.send({
                content: message.content,
                components: [row]
            });
            
            // Confirm to the user
            await message.author.send(`✅ Rules message has been posted in <#${message.channelId}> with verification buttons.`).catch(() => {});
        } catch (error) {
            console.error('Error posting rules message:', error);
            // Try to notify the user
            await message.channel.send({ 
                content: `❌ There was an error posting your rules message. Please try again.`,
                ephemeral: true 
            }).catch(() => {});
        }
    }
});

// Login bot with token
client.login(token);

// Function to format uptime nicely
function formatUptime(uptime) {
    const totalSeconds = Math.floor(uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
