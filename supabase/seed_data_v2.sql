-- Script de Geração de Dados Massivos Final (V2) para KIT Informático
-- Métricas solicitadas: 890 equipamentos, 2340 pessoas
-- Rácio: 1 Docente para cada 10 Alunos
-- Unicidade: Nomes 100% diferentes usando combinações aleatórias de 3 nomes das listas fornecidas

SET search_path = public;

-- Garantir que os enums têm os valores necessários antes de iniciar o bloco transacional
ALTER TYPE devolucao_estado ADD VALUE IF NOT EXISTS 'BOM ESTADO';

DO $$
DECLARE
    i INT;
    v_pessoa_id uuid;
    v_equip_id uuid;
    v_emp_id uuid;
    v_random_date DATE;
    v_dev_date DATE;
    v_pessoa_idx INT;
    v_equip_idx INT;
    v_equip_row public.equipamentos%ROWTYPE;
    
    -- Listas Massivas de Nomes
    v_masc TEXT[] := ARRAY['Aaron', 'Abel', 'Abílio', 'Abraão', 'Adalberto', 'Adão', 'Adelino', 'Adriano', 'Afonso', 'Agostinho', 'Alan', 'Alberto', 'Alcides', 'Aldo', 'Alejandro', 'Alessandro', 'Alex', 'Alexandre', 'Alexis', 'Alfredo', 'Almir', 'Álvaro', 'Amadeu', 'Amaro', 'Américo', 'Amílcar', 'Amir', 'Amos', 'André', 'Andrei', 'Andrés', 'Ângelo', 'Aníbal', 'Anselmo', 'Antero', 'António', 'Ariel', 'Aristides', 'Armando', 'Arnaldo', 'Artur', 'Augusto', 'Aurélio', 'Avelino', 'Axel', 'Baltasar', 'Baptista', 'Barnabé', 'Bartolomeu', 'Basílio', 'Benedito', 'Benjamim', 'Bernardo', 'Breno', 'Bruno', 'Caetano', 'Caio', 'Carlos', 'Cassiano', 'Cássio', 'Celestino', 'César', 'Cláudio', 'Clemente', 'Cristiano', 'Cristóvão', 'Dalmiro', 'Damião', 'Daniel', 'Danilo', 'Dário', 'David', 'Davi', 'Délio', 'Demétrio', 'Denis', 'Diogo', 'Domingos', 'Dorneles', 'Duarte', 'Dylan', 'Éder', 'Edgar', 'Edmundo', 'Eduardo', 'Élvio', 'Emanuel', 'Emílio', 'Enrique', 'Ernesto', 'Estêvão', 'Eurico', 'Evaristo', 'Ezequiel', 'Fábio', 'Fabrício', 'Feliciano', 'Felipe', 'Félix', 'Fernando', 'Filipe', 'Flávio', 'Florindo', 'Francisco', 'Frederico', 'Gabriel', 'Gaspar', 'Gentil', 'Geraldo', 'Germano', 'Gilberto', 'Gildásio', 'Gino', 'Gonçalo', 'Gustavo', 'Heitor', 'Hélder', 'Henrique', 'Heriberto', 'Hermano', 'Hilário', 'Homero', 'Horácio', 'Hugo', 'Humberto', 'Ibrahim', 'Iago', 'Igor', 'Ilídio', 'Inocêncio', 'Isaac', 'Isidro', 'Ismael', 'Ivan', 'Ivo', 'Jacinto', 'Jaime', 'Januário', 'Jason', 'Javier', 'Jerónimo', 'João', 'Joaquim', 'Joel', 'Jorge', 'José', 'Josué', 'Juan', 'Júlio', 'Júnior', 'Justino', 'Kevin', 'Kiko', 'Lázaro', 'Leandro', 'Léo', 'Leonardo', 'Leonel', 'Lino', 'Lucas', 'Luís', 'Lupo', 'Macário', 'Márcio', 'Marcos', 'Mariano', 'Mário', 'Martim', 'Martinho', 'Mateus', 'Matias', 'Maurício', 'Mauro', 'Maximiliano', 'Miguel', 'Moisés', 'Narciso', 'Natal', 'Nélson', 'Nuno', 'Octávio', 'Olavo', 'Olímpio', 'Orestes', 'Orlando', 'Oscar', 'Osvaldo', 'Otávio', 'Paulo', 'Pedro', 'Plácido', 'Primo', 'Rafael', 'Raimundo', 'Ramiro', 'Raul', 'Reinaldo', 'Renato', 'Ricardo', 'Roberto', 'Rodrigo', 'Rogério', 'Romeu', 'Roque', 'Rui', 'Salvador', 'Samuel', 'Sandro', 'Santiago', 'Sebastião', 'Sérgio', 'Silvano', 'Sílvio', 'Simão', 'Tiago', 'Timóteo', 'Tobias', 'Tomás', 'Tomé', 'Ulisses', 'Valentim', 'Valério', 'Vítor', 'Vicente', 'Xavier', 'Zacarias', 'Zé', 'Zenão', 'Adrien', 'Alain', 'Alexei', 'Baptiste', 'Boris', 'Cédric', 'Damien', 'Didier', 'Dmitri', 'Ethan', 'Evgeni', 'Florian', 'François', 'Gauthier', 'Grégoire', 'Guillaume', 'Henri', 'Hervé', 'Jacque', 'Jean', 'Julien', 'Karim', 'Laurent', 'Louis', 'Mathieu', 'Maxime', 'Nicolas', 'Noé', 'Olivier', 'Pascal', 'Pierre', 'Quentin', 'Raphaël', 'Rémi', 'Renaud', 'Robin', 'Sébastien', 'Simon', 'Stéphane', 'Thomas', 'Théo', 'Tristan', 'Victor', 'Vincent', 'Yannick', 'Yves', 'Achim', 'Adolf', 'Andreas', 'Benedikt', 'Clemens', 'Conrad', 'Detlef', 'Dieter', 'Erich', 'Franz', 'Friedrich', 'Georg', 'Gerhard', 'Günter', 'Hans', 'Helmut', 'Johann', 'Jonas', 'Jörg', 'Josef', 'Karl', 'Klaus', 'Kurt', 'Lars', 'Leon', 'Ludwig', 'Manfred', 'Marcus', 'Markus', 'Michael', 'Moritz', 'Oskar', 'Otto', 'Patrick', 'Paul', 'Peter', 'Philipp', 'Ralf', 'Stefan', 'Stephan', 'Tom', 'Uwe', 'Walter', 'Wilhelm', 'Wolf', 'Adam', 'Adrian', 'Andrew', 'Anthony', 'Benjamin', 'Bradley', 'Brian', 'Calvin', 'Cameron', 'Charles', 'Christopher', 'Colin', 'Craig', 'Curtis', 'Dean', 'Derek', 'Donald', 'Douglas', 'Elijah', 'Elliott', 'Evan', 'Gavin', 'George', 'Grant', 'Gregory', 'Harrison', 'Henry', 'Ian', 'Jacob', 'James', 'Jeffrey', 'Jeremy', 'John', 'Jonathan', 'Jordan', 'Joshua', 'Julian', 'Justin', 'Keith', 'Kenneth', 'Kyle', 'Lawrence', 'Liam', 'Logan', 'Luke', 'Mark', 'Martin', 'Matthew', 'Nathan', 'Nicholas', 'Noah', 'Oliver', 'Owen', 'Philip', 'Raymond', 'Richard', 'Ryan', 'Scott', 'Sean', 'Seth', 'Stephen', 'Steven', 'Timothy', 'Travis', 'Trevor', 'Tyler', 'Warren', 'Wesley', 'William', 'Zachary', 'Akira', 'Daisuke', 'Haruki', 'Hiroshi', 'Ichiro', 'Jiro', 'Kenji', 'Koji', 'Makoto', 'Masashi', 'Naoki', 'Noboru', 'Ryu', 'Satoshi', 'Shota', 'Takashi', 'Yasushi', 'Yoshi', 'Aditya', 'Ajay', 'Arjun', 'Ashok', 'Deepak', 'Ganesh', 'Girish', 'Govind', 'Mahesh', 'Manish', 'Nikhil', 'Nitin', 'Pradeep', 'Rahul', 'Rajesh', 'Ravi', 'Rohit', 'Sunil', 'Suresh', 'Varun', 'Vikram', 'Vinay', 'Vishal', 'Yusuf', 'Ahmed', 'Ali', 'Bilal', 'Faisal', 'Hassan', 'Hussein', 'Khalid', 'Mahmoud', 'Omar', 'Samir', 'Tariq', 'Walid', 'Yasser', 'Ziad', 'Anatoliy', 'Bogdan', 'Danil', 'Denys', 'Fedir', 'Grygoriy', 'Illia', 'Kostiantyn', 'Mykola', 'Oleksandr', 'Oleksiy', 'Pavlo', 'Ruslan', 'Serhiy', 'Taras', 'Vasyl', 'Volodymyr', 'Yurii', 'Aarav', 'Kabir', 'Kiran', 'Milan', 'Omkar', 'Rohan', 'Sachin', 'Saket', 'Shyam', 'Vijay', 'Wei', 'Hao'];
    
    v_fem TEXT[] := ARRAY['Aayla', 'Abigail', 'Adelaide', 'Adélia', 'Adriana', 'Agata', 'Agnes', 'Aida', 'Ailsa', 'Aisha', 'Alana', 'Alessandra', 'Alexandra', 'Alice', 'Alícia', 'Alina', 'Alisha', 'Almira', 'Aline', 'Amanda', 'Amara', 'Âmbar', 'Amélia', 'Amina', 'Amira', 'Ana', 'Anabela', 'Anabel', 'Anaís', 'Anastácia', 'Anete', 'Ângela', 'Anita', 'Antónia', 'Arabela', 'Ariana', 'Arlete', 'Áurea', 'Aurora', 'Bárbara', 'Beatriz', 'Bela', 'Benedita', 'Bianca', 'Branca', 'Brenda', 'Brígida', 'Camila', 'Carla', 'Carlota', 'Carmen', 'Carolina', 'Catarina', 'Cecília', 'Celeste', 'Célia', 'Chloe', 'Cíntia', 'Clara', 'Cláudia', 'Constança', 'Cristina', 'Dália', 'Daniela', 'Débora', 'Delfina', 'Diana', 'Dina', 'Eduarda', 'Elaine', 'Elena', 'Eleonora', 'Eliana', 'Elisa', 'Elisabete', 'Élia', 'Elvira', 'Emília', 'Emma', 'Esmeralda', 'Esperança', 'Estela', 'Eugénia', 'Eva', 'Fátima', 'Fernanda', 'Filipa', 'Flávia', 'Flora', 'Florinda', 'Francisca', 'Gabriela', 'Glória', 'Graça', 'Helena', 'Hélia', 'Inês', 'Irene', 'Isabel', 'Joana', 'Júlia', 'Juliana', 'Katarina', 'Lara', 'Laura', 'Leonor', 'Letícia', 'Lina', 'Lídia', 'Lúcia', 'Luísa', 'Luna', 'Lurdes', 'Madalena', 'Magda', 'Manuela', 'Margarida', 'Maria', 'Mariana', 'Marina', 'Marta', 'Matilde', 'Micaela', 'Miriam', 'Mónica', 'Nádia', 'Natália', 'Nicole', 'Noémia', 'Núria', 'Olga', 'Olivia', 'Patrícia', 'Paula', 'Paulina', 'Penélope', 'Petra', 'Priscila', 'Rafaela', 'Raquel', 'Regina', 'Renata', 'Rita', 'Rosália', 'Rosário', 'Rosa', 'Rute', 'Sabrina', 'Sandra', 'Sara', 'Sílvia', 'Sofia', 'Sónia', 'Susana', 'Teresa', 'Valentina', 'Vanessa', 'Vera', 'Verónica', 'Victoria', 'Virgínia', 'Vitória', 'Yasmin', 'Zélia', 'Zita', 'Abby', 'Alexia', 'Alicia', 'Alison', 'Allison', 'Amber', 'Amy', 'Ashley', 'Audrey', 'Autumn', 'Avery', 'Bella', 'Beth', 'Bethany', 'Bonnie', 'Brooke', 'Caroline', 'Charlotte', 'Chelsea', 'Christine', 'Claire', 'Crystal', 'Emily', 'Grace', 'Hannah', 'Harper', 'Hazel', 'Heather', 'Holly', 'Hope', 'Ivy', 'Jade', 'Jessica', 'Jillian', 'Julie', 'Katherine', 'Katie', 'Kayla', 'Kelly', 'Kimberly', 'Kylie', 'Lauren', 'Leah', 'Lily', 'Lisa', 'Lucy', 'Madison', 'Megan', 'Melissa', 'Mia', 'Michelle', 'Morgan', 'Natalie', 'Paige', 'Pamela', 'Rachel', 'Rebecca', 'Riley', 'Rose', 'Ruby', 'Samantha', 'Sarah', 'Sierra', 'Sophia', 'Stephanie', 'Summer', 'Taylor', 'Tiffany', 'Trinity', 'Whitney', 'Zoey', 'Adele', 'Amelie', 'Camille', 'Céline', 'Chloé', 'Colette', 'Elise', 'Émilie', 'Éva', 'Fanny', 'Gaëlle', 'Hélène', 'Isabelle', 'Juliette', 'Laetitia', 'Léa', 'Louise', 'Lucie', 'Luisa', 'Manon', 'Marie', 'Margot', 'Marion', 'Mathilde', 'Nathalie', 'Noemie', 'Océane', 'Pauline', 'Rosalie', 'Sandrine', 'Sophie', 'Valérie', 'Viviane', 'Yasmine', 'Zoé', 'Akemi', 'Aoi', 'Emi', 'Hana', 'Haruna', 'Hikari', 'Hinata', 'Kaori', 'Keiko', 'Mana', 'Megumi', 'Mika', 'Minako', 'Misaki', 'Nana', 'Naomi', 'Riko', 'Sakura', 'Satsuki', 'Tomoko', 'Yuki', 'Yumi', 'Ananya', 'Deepa', 'Divya', 'Geeta', 'Ishita', 'Kavya', 'Lakshmi', 'Meena', 'Nandini', 'Nisha', 'Pooja', 'Priya', 'Rekha', 'Ritu', 'Sangeeta', 'Shreya', 'Smita', 'Sunita', 'Swati', 'Uma', 'Usha', 'Vandana', 'Anjali', 'Amala', 'Fatima', 'Layla', 'Leila', 'Mariam', 'Maryam', 'Nadia', 'Nour', 'Rania', 'Samira', 'Sana', 'Zainab', 'Anastasia', 'Daria', 'Darya', 'Ekaterina', 'Irina', 'Katya', 'Ksenia', 'Lena', 'Ludmila', 'Natasha', 'Natalya', 'Nina', 'Oksana', 'Olena', 'Polina', 'Svetlana', 'Tatiana', 'Alžbeta', 'Anna', 'Barbora', 'Denisa', 'Jana', 'Katarína', 'Lucia', 'Mária', 'Martina', 'Monika', 'Petra', 'Silvia', 'Tereza', 'Zuzana', 'Anika', 'Annalise', 'Britta', 'Greta', 'Helga', 'Ingrid', 'Johanna', 'Karoline', 'Katja', 'Lotte', 'Marlene', 'Sabine', 'Ute', 'Wanda', 'Asel', 'Ayasha', 'Chioma', 'Dalila', 'Emeka', 'Funke', 'Habiba', 'Imani', 'Jada', 'Kalani', 'Kiona', 'Kofi', 'Leilani', 'Malaika', 'Makena', 'Naledi', 'Nia', 'Nkechi', 'Nomvula', 'Saniyah', 'Seren', 'Sienna', 'Soraya', 'Tamara', 'Taraji', 'Thandi', 'Tiana', 'Tilda', 'Tillie', 'Tina', 'Ursula', 'Valeria', 'Verena', 'Viola', 'Vivian', 'Vivienne', 'Wendy', 'Wilhelmina', 'Willow', 'Wren', 'Xena', 'Ximena', 'Yara', 'Yolanda', 'Zara', 'Zelda', 'Zena', 'Zendaya', 'Zia', 'Zola', 'Zora', 'Zuhal', 'Zula', 'Zuzu', 'Zuzanna', 'Zvezdana', 'Zwena', 'Mafalda', 'Mafra', 'Magali', 'Maite', 'Maíra', 'Maisa', 'Maiza', 'Maja', 'Malak', 'Maleeka', 'Malena', 'Malika', 'Malvina', 'Manoela', 'Maraisa', 'Marcela', 'Marcelina', 'Marcia', 'Marek', 'Marela', 'Marelize', 'Marely', 'Mareva', 'Margaux', 'Margherita', 'Margit', 'Marguerite', 'Maricel', 'Maricela', 'Mariela', 'Marieta', 'Marika', 'Marilena', 'Marilyn', 'Marimba', 'Marin', 'Marinela', 'Marinka', 'Marinna', 'Mario', 'Mariola', 'Marión', 'Marisa', 'Marisela', 'Marissa', 'Maristela', 'Marite', 'Mariu', 'Marizete'];

    v_sobrenomes TEXT[] := ARRAY['Santos', 'Ferreira', 'Silva', 'Mendes', 'Neves', 'Antunes', 'Costa', 'Oliveira', 'Pereira', 'Rodrigues', 'Almeida', 'Carvalho', 'Gomes', 'Lopes', 'Martins', 'Moreira', 'Pinto', 'Ribeiro', 'Sousa', 'Teixeira', 'Cardoso', 'Correia', 'Duarte', 'Fontes', 'Guimarães', 'Henriques', 'Machado', 'Mota', 'Nogueira', 'Queirós', 'Rocha', 'Tavares', 'Vieira', 'Afonso', 'Alves', 'Amaral', 'Andrade', 'Barros', 'Basto', 'Borges', 'Branco', 'Brito', 'Campos', 'Castro', 'Coelho', 'Cunha', 'Dias', 'Esteves', 'Figueiredo', 'Fonseca', 'Freitas', 'Garcia', 'Gaspar', 'Guerra', 'Leal', 'Leite', 'Lima', 'Magalhães', 'Marques', 'Matias', 'Melo', 'Mesquita', 'Miranda', 'Moniz', 'Monteiro', 'Moura', 'Nascimento', 'Neto', 'Nunes', 'Paiva', 'Palma', 'Paredes', 'Pash', 'Passos', 'Paz', 'Pestana', 'Pina', 'Pires', 'Quevedo', 'Ramalho', 'Ramos', 'Reis', 'Resende', 'Rosa', 'Sá', 'Salgado', 'Salgueiro', 'Sanches', 'Saraiva', 'Sequeira', 'Serpa', 'Serrano', 'Simões', 'Soares', 'Teles', 'Torres', 'Valente', 'Varela', 'Vasconcelos', 'Vaz', 'Veloso', 'Vicente', 'Vidal'];

    v_turmas TEXT[] := ARRAY['10º A', '10º B', '10º C', '11º A', '11º B', '11º C', '12º A', '12º B', '12º G', '9º A', '9º B', '8º C', '7º E'];
    
    -- Lista de 1000 nomes tecnológicos para equipamentos
    v_equip_names TEXT[] := ARRAY[
        'NomadNet', 'PixelWave', 'SwiftLink', 'TurboNode', 'GhostBeam', 'NeonPulse', 'ArcLight', 'StormByte', 'IronClad', 'SilverFox',
        'BlueVolt', 'CyberDrift', 'ZenithHub', 'VortexNet', 'PolarEdge', 'QuantumLeap', 'DarkMatter', 'SonicPath', 'NightOwl', 'AquaBeam',
        'FireLink', 'SkyNode', 'ThunderBolt', 'CrystalNet', 'ShadowWave', 'LunaBeam', 'SolarFlux', 'MoonRider', 'StarBurst', 'CosmicNet',
        'NebulaDrift', 'GalacticHub', 'OrbitNode', 'PlasmaBurst', 'IonShield', 'NeutronWave', 'QuarkLink', 'PhotonBeam', 'GravityNet', 'WarpDrive',
        'HyperLink', 'TurboWave', 'MegaNode', 'UltraBeam', 'SuperHub', 'MasterLink', 'PowerNode', 'EliteWave', 'ProBeam', 'MaxiNet',
        'AlphaLink', 'BetaNode', 'GammaWave', 'DeltaBeam', 'EpsilonNet', 'ZetaHub', 'EtaLink', 'ThetaNode', 'IotaWave', 'KappaBeam',
        'LambdaNet', 'MuHub', 'NuLink', 'XiNode', 'OmicronWave', 'PiBeam', 'RhoNet', 'SigmaHub', 'TauLink', 'UpsilonNode',
        'PhiWave', 'ChiBeam', 'PsiNet', 'OmegaHub', 'ApexLink', 'ZenNode', 'PeakWave', 'SummitBeam', 'CrestNet', 'RidgeHub',
        'BladeLink', 'EdgeNode', 'SharpWave', 'CutBeam', 'SliceNet', 'RazorHub', 'LanceLink', 'SpearNode', 'ArrowWave', 'BoltBeam',
        'DartNet', 'FlashHub', 'SparkLink', 'GlowNode', 'ShineWave', 'BrightBeam', 'LuminaNet', 'RadiantHub', 'BeaconLink', 'PulseNode',
        'WaveBeam', 'RippleNet', 'FlowHub', 'StreamLink', 'CurrentNode', 'TideWave', 'SurgeBeam', 'SwellNet', 'CrestHub', 'BreakerLink',
        'SplashNode', 'DropWave', 'MistBeam', 'CloudNet', 'FogHub', 'HazeLink', 'DewNode', 'RainWave', 'StormBeam', 'TempestNet',
        'GaleHub', 'WindLink', 'BreezeNode', 'ZephyrWave', 'GustBeam', 'CycloneNet', 'TornadoHub', 'WhirlLink', 'VortexNode', 'SpiralWave',
        'TwistBeam', 'CurlNet', 'CoilHub', 'LoopLink', 'RingNode', 'CircleWave', 'OvalBeam', 'ArcNet', 'CurveHub', 'BendLink',
        'AngleNode', 'CornerWave', 'TurnBeam', 'ShiftNet', 'MoveHub', 'DriftLink', 'SlideNode', 'GlideWave', 'SoarBeam', 'FlyNet',
        'FlightHub', 'WingLink', 'FeatherNode', 'PlumeWave', 'QuillBeam', 'TalonNet', 'ClawHub', 'FangLink', 'ToothNode', 'BoneWave',
        'SpineBeam', 'CoreNet', 'CenterHub', 'AxisLink', 'PivotNode', 'HingeWave', 'JointBeam', 'NodeNet', 'PointHub', 'TipLink',
        'ApexNode', 'PinnacleWave', 'TopBeam', 'CrownNet', 'CapHub', 'HoodLink', 'DomeNode', 'VaultWave', 'ArchBeam', 'SpanNet',
        'BridgeHub', 'GateLink', 'PortalNode', 'DoorWave', 'EntryBeam', 'PassNet', 'RouteHub', 'PathLink', 'TrailNode', 'TrackWave',
        'RailBeam', 'LineNet', 'GridHub', 'MeshLink', 'WebNode', 'NetWave', 'LinkBeam', 'ChainNet', 'BondHub', 'TieLink',
        'KnotNode', 'WeavedWave', 'BraidBeam', 'TwineNet', 'CordHub', 'RopeLink', 'CableNode', 'WireWave', 'FiberBeam', 'ThreadNet',
        'StrandHub', 'FilamentLink', 'RayNode', 'BeamWave', 'ShaftBeam', 'PillarNet', 'ColumnHub', 'TowerLink', 'SpireNode', 'NeedleWave',
        'PinBeam', 'NailNet', 'BoltHub', 'ScrewLink', 'RivetNode', 'StapleWave', 'ClipBeam', 'HookNet', 'LatchHub', 'LockLink',
        'KeyNode', 'CodeWave', 'CipherBeam', 'CryptoNet', 'VaultHub', 'SafeLink', 'ShieldNode', 'GuardWave', 'ArmorBeam', 'FortNet',
        'BastionHub', 'RampartLink', 'WallNode', 'BarrierWave', 'BlockBeam', 'BarNet', 'GateHub', 'FenceLink', 'BoundNode', 'LimitWave',
        'BorderBeam', 'EdgeNet', 'FringeHub', 'RimLink', 'BrimNode', 'MarginWave', 'FrameBeam', 'BorderNet', 'OutlineHub', 'SkeletonLink',
        'StructureNode', 'FrameworkWave', 'BuildBeam', 'MakeNet', 'ForgeHub', 'CastLink', 'MoldNode', 'ShapeWave', 'FormBeam', 'DesignNet',
        'PatternHub', 'LayoutLink', 'SchemeNode', 'PlanWave', 'BlueprintBeam', 'MapNet', 'ChartHub', 'GraphLink', 'PlotNode', 'DiagramWave',
        'ModelBeam', 'ReplicaNet', 'CopyHub', 'CloneLink', 'TwinNode', 'DualWave', 'PairBeam', 'MatchNet', 'MirrorHub', 'EchoLink',
        'ReflectNode', 'ShadowWave', 'GhostBeam', 'PhantomNet', 'SpecterHub', 'WreathLink', 'HaloNode', 'AuraWave', 'GlowBeam', 'ShimmerNet',
        'FlickerHub', 'TwinkleLink', 'SparkleNode', 'GlitterWave', 'DazzleBeam', 'BlindNet', 'BlazeHub', 'FlameLink', 'FireNode', 'EmberWave',
        'CoalBeam', 'AshNet', 'CinderHub', 'SootLink', 'SmolderNode', 'ScorchWave', 'BurnBeam', 'CharNet', 'TorchHub', 'CandleLink',
        'WickNode', 'LampWave', 'LanternBeam', 'LightNet', 'BulbHub', 'TubeLink', 'PipeNode', 'ConduitWave', 'DuctBeam', 'ChannelNet',
        'TrenchHub', 'TunnelLink', 'BoreholNode', 'ShaftWave', 'MineBeam', 'PitNet', 'WellHub', 'PoolLink', 'PondNode', 'LakeWave',
        'RiverBeam', 'StreamNet', 'CreekHub', 'BrookLink', 'SpringNode', 'SourceWave', 'OriginBeam', 'RootNet', 'BaseHub', 'FoundationLink',
        'GroundNode', 'EarthWave', 'SoilBeam', 'CrustNet', 'LayerHub', 'DepthLink', 'DeepNode', 'AbyssWave', 'VoidBeam', 'SpaceNet',
        'EmptyHub', 'BlankLink', 'ClearNode', 'OpenWave', 'FreeBeam', 'WildNet', 'RawHub', 'PureLink', 'CleanNode', 'FreshWave',
        'NewBeam', 'YoungNet', 'BrightHub', 'VividLink', 'RichNode', 'BoldWave', 'StrongBeam', 'ToughNet', 'HardHub', 'SteelLink',
        'IronNode', 'MetalWave', 'ChromeBeam', 'TitanNet', 'CarbonHub', 'GraphiteLink', 'DiamondNode', 'CrystalWave', 'GlassBeam', 'QuartzNet',
        'GraniteHub', 'MarbleLink', 'SlateNode', 'StoneWave', 'RockBeam', 'BoulderNet', 'CliffHub', 'CragLink', 'PeakNode', 'SummitWave',
        'MountBeam', 'AlpineNet', 'HighlandHub', 'PlateauLink', 'MesaNode', 'PlainWave', 'SteppeBeam', 'TundraNet', 'ArcticHub', 'PolarLink',
        'GlacierNode', 'IceWave', 'FrostBeam', 'SnowNet', 'WhiteHub', 'BlizzardLink', 'ColdNode', 'ChillWave', 'CoolBeam', 'BreezyNet',
        'AirHub', 'AtmoLink', 'SkyNode', 'HighWave', 'UpBeam', 'AboveNet', 'OverHub', 'AcrossLink', 'ThroughNode', 'BeyondWave',
        'FarBeam', 'DistantNet', 'RemoteHub', 'WanderLink', 'RoamNode', 'DriftWave', 'FloatBeam', 'HoverNet', 'SuspendHub', 'HangLink',
        'PendNode', 'SwingWave', 'RockBeam', 'OscillateNet', 'PulseHub', 'BeatLink', 'RhythmNode', 'TempoWave', 'CadenceBeam', 'MeterNet',
        'TimeHub', 'ClockLink', 'WatchNode', 'TimerWave', 'CountBeam', 'TallyNet', 'ScoreHub', 'RateLink', 'SpeedNode', 'VelocityWave',
        'AccelBeam', 'RushNet', 'DashHub', 'SprintLink', 'RunNode', 'JogWave', 'WalkBeam', 'StepNet', 'StridHub', 'PaceLink',
        'GaitNode', 'MarchWave', 'ParadeBeam', 'ProcessNet', 'FlowHub', 'MoveLink', 'ShiftNode', 'TransferWave', 'SendBeam', 'TransmitNet',
        'CastHub', 'BroadcastLink', 'StreamNode', 'FeedWave', 'SignalBeam', 'FreqNet', 'BandHub', 'SpectrumLink', 'RangeNode', 'ZoneWave',
        'AreaBeam', 'FieldNet', 'SpaceHub', 'RegionLink', 'SectorNode', 'SegmentWave', 'PartBeam', 'PieceNet', 'FragmentHub', 'ChunkLink',
        'BitNode', 'ByteWave', 'PacketBeam', 'DataNet', 'InfoHub', 'KnowLink', 'LearnNode', 'StudyWave', 'ReadBeam', 'ScanNet',
        'SearchHub', 'FindLink', 'SeekNode', 'HuntWave', 'TraceBeam', 'TrackNet', 'FollowHub', 'ChaseLink', 'PursueNode', 'CatchWave',
        'GrabBeam', 'HoldNet', 'GraspHub', 'ClutchLink', 'PinchNode', 'SqueezeWave', 'CompressBeam', 'PackNet', 'FitHub', 'TightLink',
        'SnugNode', 'CozyWave', 'WarmBeam', 'HotNet', 'ScaldHub', 'SteamLink', 'VaporNode', 'MistWave', 'GasBeam', 'AirNet',
        'BreathHub', 'ExhaleLink', 'InhaleNode', 'BlowWave', 'PuffBeam', 'WhiffNet', 'ScentHub', 'SmellLink', 'AromeNode', 'OdorWave',
        'FreshBeam', 'MintNet', 'ZestHub', 'TangyLink', 'SharpNode', 'SpicyWave', 'HotBeam', 'FireyNet', 'BurningHub', 'SizzleLink',
        'CrispNode', 'CrunchWave', 'SnapBeam', 'PopNet', 'BangHub', 'BlastLink', 'BoomNode', 'EchoWave', 'RingBeam', 'ToneNet',
        'SoundHub', 'NoisyLink', 'LoudNode', 'SilentWave', 'QuietBeam', 'HushNet', 'MuteHub', 'DullLink', 'BluntNode', 'SmoothWave',
        'SlickBeam', 'SlipperyNet', 'GlossyHub', 'ShinyLink', 'PolishedNode', 'BrightWave', 'GleamBeam', 'GlistenNet', 'SparkHub', 'FlashLink',
        'BlinkNode', 'WinkWave', 'GlanceBeam', 'PeekNet', 'SightHub', 'ViewLink', 'LookNode', 'SeeWave', 'WatchBeam', 'ObserveNet',
        'NoteHub', 'MarkLink', 'TagNode', 'LabelWave', 'NameBeam', 'CallNet', 'TitleHub', 'HeadLink', 'TopNode', 'LeadWave',
        'FrontBeam', 'FaceNet', 'FrontHub', 'ForwardLink', 'AheadNode', 'BeforeWave', 'PriorBeam', 'EarlyNet', 'FirstHub', 'PrimaryLink',
        'MainNode', 'CentralWave', 'HubBeam', 'KeyNet', 'VitalHub', 'CoreLink', 'EssentialNode', 'CriticalWave', 'CrucialBeam', 'ImportantNet',
        'MajorHub', 'GreatLink', 'LargeNode', 'BigWave', 'HugeBeam', 'GigaNet', 'MegaHub', 'TerraLink', 'PetaNode', 'ExaWave',
        'ZettaBeam', 'YottaNet', 'NanoHub', 'MicroLink', 'MilliNode', 'CentiWave', 'DeciBeam', 'UnitNet', 'SingleHub', 'SoloLink',
        'MonoNode', 'UniWave', 'OneBeam', 'PrimeNet', 'FirstHub', 'LeadLink', 'TopNode', 'AceWave', 'StarBeam', 'HeroNet',
        'ChampHub', 'WinLink', 'VictorNode', 'ConquerWave', 'DominateBeam', 'RuleNet', 'ReignHub', 'CommandLink', 'ControlNode', 'MasterWave',
        'OverlordBeam', 'ChiefNet', 'BossHub', 'CaptainLink', 'PilotNode', 'NavigatorWave', 'HelmBeam', 'SteerNet', 'GuideHub', 'DirectLink',
        'PointNode', 'AimWave', 'TargetBeam', 'GoalNet', 'MissionHub', 'QuestLink', 'TaskNode', 'JobWave', 'WorkBeam', 'LaborNet',
        'EarnHub', 'GainLink', 'WinNode', 'ProfitWave', 'YieldBeam', 'OutputNet', 'ProduceHub', 'CreateLink', 'MakeNode', 'BuildWave',
        'ConstructBeam', 'AssembleNet', 'CompileHub', 'GatherLink', 'CollectNode', 'AmassWave', 'StoreBeam', 'SaveNet', 'KeepHub', 'HoldLink',
        'MaintainNode', 'SustainWave', 'SupportBeam', 'BackNet', 'CarryHub', 'BearLink', 'LoadNode', 'FillWave', 'ChargeBeam', 'PowerNet',
        'FuelHub', 'EnergyLink', 'ForceNode', 'DriveWave', 'PushBeam', 'ThrowNet', 'LaunchHub', 'FireLink', 'ShootNode', 'AimWave',
        'StrikeBeam', 'HitNet', 'PunchHub', 'KickLink', 'TossNode', 'FlipWave', 'SpinBeam', 'TurnNet', 'RotateHub', 'TwistLink',
        'WindNode', 'CoilWave', 'WrapBeam', 'BindNet', 'TieHub', 'KnotLink', 'SecureNode', 'FasteWave', 'FixBeam', 'AttachNet',
        'ConnectHub', 'JoinLink', 'MergeNode', 'BlendWave', 'MixBeam', 'CombineNet', 'FuseHub', 'WeldLink', 'BondNode', 'SealWave',
        'CloseBeam', 'ShutNet', 'LockHub', 'BlockLink', 'StopNode', 'HaltWave', 'FreezeBeam', 'PauseNet', 'WaitHub', 'DelayLink',
        'StallNode', 'SlowWave', 'BreakBeam', 'SplitNet', 'DivideHub', 'SeparateLink', 'CutNode', 'SliceWave', 'ChopBeam', 'HackNet',
        'ClipHub', 'TrimLink', 'SnipNode', 'CropWave', 'PruneBeam', 'ShaveNet', 'ShearHub', 'ScrapeLink', 'ScrapNode', 'ScribbleWave',
        'DrawBeam', 'SketchNet', 'DraftHub', 'OutlineLink', 'TraceNode', 'CopyWave', 'DuplicateBeam', 'RepeatNet', 'LoopHub', 'CycleLink',
        'RoundNode', 'SequenceWave', 'ChainBeam', 'SeriesNet', 'SetHub', 'GroupLink', 'ClusterNode', 'BunchWave', 'BatchBeam', 'PackNet',
        'BundleHub', 'KitLink', 'GearNode', 'ToolWave', 'DeviceBeam', 'UnitNet', 'ModuleHub', 'ComponentLink', 'PartNode', 'PieceWave',
        'ElementBeam', 'FactorNet', 'AgentHub', 'ProxyLink', 'RelayNode', 'BoostWave', 'AmplifyBeam', 'ExtendNet', 'ExpandHub', 'GrowLink',
        'ScaleNode', 'RiseWave', 'ClimbBeam', 'AscendNet', 'LiftHub', 'ElevateLink', 'RaiseNode', 'UpgradeWave', 'UpdateBeam', 'RefreshNet',
        'ReloadHub', 'ResetLink', 'RestartNode', 'RebootWave', 'RecoverBeam', 'RestoreNet', 'BackupHub', 'SaveLink', 'ArchiveNode',
        'StoreWave', 'CacheBeam', 'BufferNet', 'MemoryHub', 'RamLink', 'RomNode', 'DiskWave', 'DriveBeam', 'FlashNet', 'SolidHub',
        'StateLink', 'StaticNode', 'DynamicWave', 'LiveBeam', 'ActiveNet', 'RunningHub', 'OnlineLink', 'ConnectedNode', 'LinkedWave',
        'BridgedBeam', 'TetheredNet', 'WiredHub', 'PatchedLink', 'RoutedNode', 'SwitchedWave', 'HoppedBeam', 'PingedNet', 'TracedHub',
        'MappedLink', 'LoggedNode', 'MonitoredWave', 'ScannedBeam', 'DetectedNet', 'FoundHub', 'DiscoveredLink', 'IdentifiedNode', 'RecognizedWave',
        'AuthBeam', 'VerifiedNet', 'ValidatedHub', 'CertifiedLink', 'TrustedNode', 'SecureWave', 'SafeBeam', 'ProtectedNet', 'EncryptedHub',
        'HiddenLink', 'StealthNode', 'InvisibleWave', 'AnonymousBeam', 'PrivateNet', 'PersonalHub', 'UniqueLink', 'CustomNode', 'SpecialWave',
        'ExclusiveBeam', 'PremiumNet', 'SelectHub', 'ChosenLink', 'PickedNode', 'FavoriteWave', 'TopBeam', 'BestNet', 'FinestHub',
        'PrimeLink', 'GoldNode', 'DiamondWave', 'PlatinumBeam', 'EliteNet', 'UltraHub', 'MegaLink', 'GigaNode', 'TerraWave', 'OmegaBeam',
        'AlphaNet', 'ApexHub', 'ZenithLink', 'CrestNode', 'PinnacleWave', 'SummitBeam', 'PeakNet', 'TopperHub', 'UpperLink', 'HigherNode',
        'AboveWave', 'OverBeam', 'SuperNet', 'UltraHub', 'ExtraLink', 'MaxNode', 'FullWave', 'TotalBeam', 'CompleteNet', 'WholeHub',
        'EntireLink', 'AllNode', 'EverWave', 'AlwaysBeam', 'ForeverNet', 'InfinityHub', 'EndlessLink', 'BoundlessNode', 'LimitlessWave',
        'FreeBeam', 'OpenNet', 'WideHub', 'BroadLink', 'VastNode', 'ImmenseWave', 'GigantBeam', 'ColossiNet', 'TitanHub', 'GiantLink',
        'MammothNode', 'MassiveWave', 'HeavyBeam', 'SolidNet', 'DenseHub', 'ThickLink', 'RobustNode', 'SturdyWave', 'DurableBeam', 'ToughNet',
        'ResistHub', 'HardenLink', 'ReinforcedNode', 'FortifiedWave', 'ArmoredBeam', 'LockedNet', 'SealedHub', 'EncasedLink', 'ShieldedNode', 'WrappedWave',
        'CoveredBeam', 'HiddenNet', 'ConcealHub', 'MaskLink', 'CamouflageNode', 'BlendedWave', 'MergedBeam', 'FusedNet', 'IntegratedHub', 'UnifiedLink',
        'JoinedNode', 'CombinedWave', 'TogetherBeam', 'SyncedNet', 'AlignedHub', 'BalancedLink', 'CalibratedNode', 'TunedWave'
    ];

    v_componentes TEXT[] := ARRAY['ecra', 'disco', 'ram', 'board', 'bateria', 'teclado', 'rato', 'carregador'];
    
    v_pessoa_nome TEXT;
    v_n1 TEXT; v_n2 TEXT; v_n3 TEXT;
    v_email_gerado TEXT;
    v_is_docente BOOLEAN;
BEGIN
    -- Limpar tabelas para novo seed
    DELETE FROM public.avarias;
    DELETE FROM public.devolucoes;
    DELETE FROM public.emprestimos;
    DELETE FROM public.pedidos;
    DELETE FROM public.pessoas WHERE email LIKE '%@4online.pt';
    DELETE FROM public.equipamentos WHERE numero_serie LIKE 'SN-SEED-%';

    -- 1. Gerar 2340 Pessoas (1 Docente para cada 10 Alunos)
    RAISE NOTICE 'A gerar 2340 pessoas com nomes 100%% únicos...';
    FOR i IN 1..2340 LOOP
        v_pessoa_id := gen_random_uuid();
        v_is_docente := (i % 11 = 0);
        
        -- Selecionar 3 nomes aleatórios baseados no índice para garantir unicidade absoluta
        IF i % 2 = 0 THEN
            v_n1 := v_masc[1 + (i % array_length(v_masc, 1))];
            v_n2 := v_sobrenomes[1 + ((i * 2) % array_length(v_sobrenomes, 1))];
            v_n3 := v_sobrenomes[1 + ((i * 5) % array_length(v_sobrenomes, 1))];
        ELSE
            v_n1 := v_fem[1 + (i % array_length(v_fem, 1))];
            v_n2 := v_sobrenomes[1 + ((i * 3) % array_length(v_sobrenomes, 1))];
            v_n3 := v_sobrenomes[1 + ((i * 7) % array_length(v_sobrenomes, 1))];
        END IF;

        v_pessoa_nome := v_n1 || ' ' || v_n2 || ' ' || v_n3;
        
        -- Email
        IF NOT v_is_docente THEN
            v_email_gerado := 'a' || (10000 + i) || '@4online.pt';
        ELSE
            v_email_gerado := lower(v_n1) || '.' || lower(v_n3) || i || '@4online.pt';
        END IF;

        INSERT INTO public.pessoas (id, nome, email, tipo, turma, n_processo, ee_nome, ee_email, ativo, created_at)
        VALUES (
            v_pessoa_id, v_pessoa_nome, v_email_gerado,
            CASE WHEN v_is_docente THEN 'Docente'::pessoa_tipo ELSE 'Aluno'::pessoa_tipo END,
            CASE WHEN NOT v_is_docente THEN v_turmas[1 + (i % 13)] ELSE NULL END,
            'PROC-' || (10000 + i),
            CASE WHEN NOT v_is_docente THEN 'EE ' || v_masc[1 + ((i+2) % array_length(v_masc, 1))] || ' ' || v_sobrenomes[1 + ((i+2) % array_length(v_sobrenomes, 1))] ELSE NULL END,
            CASE WHEN NOT v_is_docente THEN 'ee_' || (10000 + i) || '@4online.pt' ELSE NULL END,
            true, CURRENT_DATE - 400
        );
    END LOOP;

    -- 2. Gerar 890 Equipamentos
    RAISE NOTICE 'A gerar 890 equipamentos únicos...';
    FOR i IN 1..890 LOOP
        v_equip_id := gen_random_uuid();
        INSERT INTO public.equipamentos (id, numero_serie, numero_imobilizado, designacao, tipo, marca, modelo, estado, data_entrada, created_at)
        VALUES (
            v_equip_id, 'SN-SEED-' || LPAD(i::text, 4, '0'), 'IMOB-' || (20000 + i),
            v_equip_names[i], -- Usa a lista de 1000 nomes tecnológicos
            CASE WHEN i % 3 <> 0 THEN 'Portátil' ELSE 'Hotspot' END,
            CASE WHEN i % 5 = 0 THEN 'HP' WHEN i % 5 = 1 THEN 'Acer' WHEN i % 5 = 2 THEN 'Lenovo' WHEN i % 5 = 3 THEN 'Dell' ELSE 'Asus' END,
            'Model-X' || (i % 10), 'DISPONÍVEL', CURRENT_DATE - 450, CURRENT_DATE - 450
        );
    END LOOP;

    -- 3. Gerar 843 Empréstimos e Devoluções
    RAISE NOTICE 'A gerar 843 empréstimos e histórico de devoluções...';
    FOR i IN 1..843 LOOP
        v_pessoa_idx := 1 + (i % 2300);
        v_equip_idx := 1 + (i % 880);
        
        -- Selecionar pessoa e equipamento existentes
        SELECT id, nome INTO v_pessoa_id, v_pessoa_nome FROM public.pessoas WHERE email LIKE '%@4online.pt' ORDER BY id OFFSET (v_pessoa_idx - 1) LIMIT 1;
        SELECT id, designacao, numero_serie INTO v_equip_row.id, v_equip_row.designacao, v_equip_row.numero_serie FROM public.equipamentos WHERE numero_serie LIKE 'SN-SEED-%' ORDER BY id OFFSET (v_equip_idx - 1) LIMIT 1;

        -- Distribuir empréstimos/devoluções pelos últimos 12 meses (inclui os últimos 5 meses)
        -- 20..364 dias atrás, com espalhamento determinístico
        v_random_date := CURRENT_DATE - (20 + ((i * 97) % 345));
        
        IF v_pessoa_id IS NOT NULL AND v_equip_row.id IS NOT NULL THEN
            v_emp_id := gen_random_uuid();
            -- Inserir Empréstimo
            INSERT INTO public.emprestimos (id, equipamento_id, pessoa_id, data_emprestimo, estado, created_at)
            VALUES (v_emp_id, v_equip_row.id, v_pessoa_id, v_random_date, 'ATIVO', v_random_date);
            
            -- Gerar ~475 devoluções distribuídas ao longo de todo o período (não apenas no início do loop)
            -- Usamos uma permutação determinística para selecionar exatamente 475 dos 843 empréstimos
            IF (((i * 37) % 843) + 1) <= 475 THEN
                v_dev_date := v_random_date + (2 + (i % 15));
                
                -- Distribuição pretendida no estado final:
                -- - 75% OK/em condições (vira BOM ESTADO após ARRANJADO)
                -- - 10% mantém-se A REVER
                -- - 15% COM DANOS
                -- (estado inicial continua apenas A REVER ou COM DANOS)
                
                IF (((i * 91) % 475) + 1) <= 357 THEN
                    -- 75% OK: começa como A REVER e fica ARRANJADO (trigger marca devolução como BOM ESTADO)
                    INSERT INTO public.devolucoes (id, emprestimo_id, equipamento_id, pessoa_id, data_devolucao, estado_equipamento, created_at)
                    VALUES (gen_random_uuid(), v_emp_id, v_equip_row.id, v_pessoa_id, v_dev_date, 'A REVER'::devolucao_estado, v_dev_date);
                    
                    -- Para simular o "OK/Em condições" após revisão:
                    -- Atualizamos a avaria para ARRANJADO. O trigger after_update_avaria vai mudar a devolução para BOM ESTADO.
                    UPDATE public.avarias SET 
                        estado = 'ARRANJADO'::avaria_estado, 
                        diagnostico = 'Equipamento em bom estado após revisão.',
                        resolucao = 'Verificado e pronto para novo empréstimo.',
                        created_at = v_dev_date,
                        data_resolucao = v_dev_date
                    WHERE devolucao_id IN (SELECT id FROM public.devolucoes WHERE emprestimo_id = v_emp_id);
                ELSIF (((i * 91) % 475) + 1) <= 404 THEN
                    -- 10% pendentes: começa e mantém-se A REVER
                    INSERT INTO public.devolucoes (id, emprestimo_id, equipamento_id, pessoa_id, data_devolucao, estado_equipamento, created_at)
                    VALUES (gen_random_uuid(), v_emp_id, v_equip_row.id, v_pessoa_id, v_dev_date, 'A REVER'::devolucao_estado, v_dev_date);
                ELSE
                    -- 15% COM DANOS
                    INSERT INTO public.devolucoes (id, emprestimo_id, equipamento_id, pessoa_id, data_devolucao, estado_equipamento, created_at)
                    VALUES (gen_random_uuid(), v_emp_id, v_equip_row.id, v_pessoa_id, v_dev_date, 'COM DANOS'::devolucao_estado, v_dev_date);
                    
                    -- Sincronizar avaria (Algumas ficam ativas, outras resolvidas)
                    IF i % 4 = 0 THEN
                        UPDATE public.avarias SET 
                            estado = 'DIAGNOSTICADO'::avaria_estado, 
                            componentes = jsonb_build_object(v_componentes[1 + (i % 8)], 'AVARIADO'), 
                            created_at = v_dev_date
                        WHERE devolucao_id IN (SELECT id FROM public.devolucoes WHERE emprestimo_id = v_emp_id);
                    ELSE
                        IF v_componentes[1 + (i % 8)] = 'ecra' THEN
                            UPDATE public.avarias SET estado = 'INUTILIZADO'::avaria_estado, componentes = jsonb_build_object('ecra', 'AVARIADO'), created_at = v_dev_date WHERE devolucao_id IN (SELECT id FROM public.devolucoes WHERE emprestimo_id = v_emp_id);
                        ELSE
                            UPDATE public.avarias SET estado = 'ARRANJADO'::avaria_estado, componentes = jsonb_build_object(v_componentes[1 + (i % 8)], 'AVARIADO'), created_at = v_dev_date WHERE devolucao_id IN (SELECT id FROM public.devolucoes WHERE emprestimo_id = v_emp_id);
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;
    RAISE NOTICE 'Empréstimos e Devoluções inseridos com sucesso.';

    -- 4. Gerar 50 Avarias Diretas (Apenas se o equipamento não tiver avaria ativa)
    FOR i IN 1..50 LOOP
        SELECT * INTO v_equip_row 
        FROM public.equipamentos e 
        WHERE e.estado IN ('DISPONÍVEL', 'EM AVARIA') 
          AND e.numero_serie LIKE 'SN-SEED-%' 
          AND NOT EXISTS (
              SELECT 1 FROM public.avarias a 
              WHERE a.equipamento_id = e.id 
                AND a.estado NOT IN ('ARRANJADO'::avaria_estado, 'INUTILIZADO'::avaria_estado)
          )
        ORDER BY random() LIMIT 1;

        v_random_date := CURRENT_DATE - (5 + (random() * 350)::int);
        IF v_equip_row.id IS NOT NULL THEN
            INSERT INTO public.avarias (equipamento_id, equipamento_info, origem, estado, componentes, created_at)
            VALUES (v_equip_row.id, v_equip_row.designacao || ' (' || v_equip_row.numero_serie || ')', 'DIRETA', 'A REVER', jsonb_build_object(v_componentes[1 + (i % 8)], 'AVARIADO'), v_random_date);
            UPDATE public.equipamentos SET estado = 'EM AVARIA'::equipamento_estado WHERE id = v_equip_row.id;
        END IF;
    END LOOP;

    -- 5. Gerar 150 Pedidos (Apenas 3 Pendentes)
    FOR i IN 1..150 LOOP
        SELECT id, nome INTO v_pessoa_id, v_pessoa_nome FROM public.pessoas WHERE email LIKE '%@4online.pt' ORDER BY id OFFSET (1 + (i % 2300)) LIMIT 1;
        v_random_date := CURRENT_DATE - (i % 180);
        IF v_pessoa_id IS NOT NULL THEN
            INSERT INTO public.pedidos (
                pessoa_id, 
                pessoa_info, 
                tipo, 
                status, 
                data_pedido, 
                resolvido, 
                created_at,
                -- Campos obrigatórios para SUPORTE devido à constraint suporte_check
                numero_serie,
                descricao_equipamento,
                descricao_suporte
            )
            VALUES (
                v_pessoa_id, 
                v_pessoa_nome, 
                CASE WHEN i % 3 = 0 THEN 'EMPRÉSTIMO'::pedido_tipo WHEN i % 3 = 1 THEN 'DEVOLUÇÃO'::pedido_tipo ELSE 'SUPORTE'::pedido_tipo END,
                CASE WHEN i <= 3 THEN 'PENDENTE'::pedido_status WHEN i % 3 = 0 THEN 'AGENDADO'::pedido_status WHEN i % 3 = 1 THEN 'REJEITADO'::pedido_status ELSE 'RESOLVIDO'::pedido_status END,
                v_random_date, 
                CASE WHEN i <= 3 OR i % 3 = 0 THEN false ELSE true END, 
                v_random_date,
                CASE WHEN i % 3 = 2 THEN 'SN-SUP-' || i ELSE NULL END,
                CASE WHEN i % 3 = 2 THEN 'Equipamento Suporte ' || i ELSE NULL END,
                CASE WHEN i % 3 = 2 THEN 'Problema técnico reportado no seed #' || i ELSE NULL END
            );
        END IF;
    END LOOP;

    RAISE NOTICE 'Seed v2 finalizado com sucesso absoluto!';
END $$;
